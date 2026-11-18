import { isFallIncident } from '../operations/emergencyCenter.js';
import { emergencyError } from '../operations/emergencyApi.js';
import { openCameraSession } from './robotCamera.js';

const closing = new Map();
export const incidentMediaMode = incident => isFallIncident(incident) ? 'MONITOR' : 'ASSIST';
export const matchesIncidentMedia = (session, incident, account, owned = true) =>
  session?.robotId === incident.robotId && session?.incidentId === incident.incidentId
  && session?.mode === incidentMediaMode(incident)
  && (!owned || session.staffAccountId === account.accountId);

export function activeFallReview(media, incident, account, now = Date.now()) {
  return isFallIncident(incident) && media?.phase === 'live' && media.videoFresh === true && !!media.track && !media.track.isMuted
    && now - media.checkedAt < 10000 && now >= media.checkedAt
    && matchesIncidentMedia(media.session, incident, account) && openCameraSession(media.session, now)
    && media.session.state === 'ACTIVE' && Number.isFinite(Date.parse(media.session.deviceSeenAt));
}

// An incident viewer is deliberately separate from the general robot monitor:
// it must accept/join the session bound to this exact incident and account.
export class IncidentCameraConnection {
  constructor({ incident, account, request, loadSdk, onChange }) {
    Object.assign(this, { incident, account, request, loadSdk, onChange });
    this.key = `${account.accountId}:${incident.robotId}`;
    this.abort = new AbortController(); this.tracks = new Map();
    this.state = { phase: 'connecting', message: 'Đang mở camera của sự cố…', track: null, audioTracks: [], session: null, checkedAt: 0, micEnabled: false };
  }
  emit(patch) { if (!this.stopped) { this.state = { ...this.state, ...patch }; this.onChange(this.state); } }
  call(path, options = {}) { return this.request(path, { signal: this.abort.signal, ...options }); }
  mutate(path, body) {
    // Read cancellation must not discard an accepted session's response.
    this.pending = this.request(path, { method: 'POST', ...(body === undefined ? {} : { body }) }).then(session => {
      if (matchesIncidentMedia(session, this.incident, this.account)) {
        this.session = session; this.acquired = true;
      }
      return session;
    });
    return this.pending;
  }
  async start() {
    try {
      await closing.get(this.key);
      if (this.stopped) return;
      const configuration = await this.call('/api/v1/media/configuration');
      if (!configuration?.enabled) throw Error('MEDIA_DISABLED');
      const sessions = await this.call('/api/v1/media-sessions');
      if (!Array.isArray(sessions)) throw Error('Danh sách phiên camera không hợp lệ.');
      let session = sessions.find(value => matchesIncidentMedia(value, this.incident, this.account, false) && openCameraSession(value));
      if (!session) {
        session = await this.mutate('/api/v1/media-sessions', { robotId: this.incident.robotId, incidentId: this.incident.incidentId, mode: incidentMediaMode(this.incident) });
        this.session = session; this.acquired = true;
      }
      if (this.stopped) return;
      if (!matchesIncidentMedia(session, this.incident, this.account, false) || !openCameraSession(session)) throw Error('Phiên camera không khớp sự cố.');
      if (session.staffAccountId && session.staffAccountId !== this.account.accountId) throw Error('MEDIA_ALREADY_ACCEPTED_BY_ANOTHER_STAFF');
      if (session.state === 'RINGING') {
        session = await this.mutate(`/api/v1/media-sessions/${session.sessionId}/accept`);
      }
      this.session = session; this.acquired = true;
      if (this.stopped) return;
      if (!matchesIncidentMedia(session, this.incident, this.account) || !openCameraSession(session)) throw Error('Phiên camera không khớp tài khoản.');
      const credentials = await this.call(`/api/v1/media-sessions/${session.sessionId}/join-token`, { method: 'POST' });
      if (this.stopped) return;
      const url = new URL(credentials?.url);
      if (!matchesIncidentMedia(credentials.session, this.incident, this.account)
        || credentials.session.sessionId !== session.sessionId || !openCameraSession(credentials.session)
        || credentials.room !== `mar-${session.sessionId}` || credentials.identity !== `staff-${this.account.accountId}`
        || url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash
        || !credentials.token || Date.parse(credentials.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(credentials.expiresAt))) throw Error('Thông tin kết nối camera không hợp lệ.');
      this.session = credentials.session;
      this.emit({ session: this.session, checkedAt: Date.now() });
      const sdk = await this.loadSdk();
      if (this.stopped) return;
      const room = new sdk.Room({ adaptiveStream: true, dynacast: true }); this.room = room;
      const current = () => !this.stopped && this.room === room;
      room.on(sdk.RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (!current() || participant.identity !== `robot-${this.incident.robotId}`) return;
        if (track.kind === sdk.Track.Kind.Video && publication.source === sdk.Track.Source.Camera) {
          this.emit({ track, videoFresh: false, phase: track.isMuted ? 'waiting' : 'live', message: 'Đang nhận camera trực tiếp từ robot.' });
        } else if (track.kind === sdk.Track.Kind.Audio && incidentMediaMode(this.incident) === 'ASSIST') {
          this.tracks.set(track.sid, track); this.emit({ audioTracks: [...this.tracks.values()] });
        }
      });
      room.on(sdk.RoomEvent.TrackUnsubscribed, track => {
        if (!current()) return;
        if (this.state.track === track) this.emit({ track: null, phase: 'waiting', message: 'Robot đang ngừng gửi hình. Chưa thể xác nhận.' });
        this.tracks.delete(track.sid); this.emit({ audioTracks: [...this.tracks.values()] });
      });
      room.on(sdk.RoomEvent.TrackMuted, publication => {
        if (current() && publication.track === this.state.track) this.emit({ phase: 'waiting', message: 'Camera đang tạm dừng. Chưa thể xác nhận.' });
      });
      room.on(sdk.RoomEvent.TrackUnmuted, publication => {
        if (current() && publication.track === this.state.track) this.emit({ phase: 'live', message: 'Đang nhận camera trực tiếp từ robot.' });
      });
      room.on(sdk.RoomEvent.Reconnecting, () => { if (current()) this.emit({ phase: 'reconnecting', message: 'Camera đang kết nối lại. Chưa thể xác nhận.' }); });
      room.on(sdk.RoomEvent.Reconnected, () => { if (current()) { this.emit({ phase: this.state.track ? 'live' : 'waiting' }); this.poll(); } });
      room.on(sdk.RoomEvent.Disconnected, reason => {
        if (!current()) return;
        if (sdk.DisconnectReason?.DUPLICATE_IDENTITY !== undefined && reason === sdk.DisconnectReason.DUPLICATE_IDENTITY) this.acquired = false;
        clearTimeout(this.timer); this.emit({ phase: 'error', track: null, micEnabled: false, message: 'Kết nối camera đã gián đoạn. Sự cố vẫn được giữ để kiểm tra.' });
      });
      this.emit({ phase: 'waiting', message: 'Đang chờ robot gửi hình…' });
      await room.connect(credentials.url, credentials.token, { autoSubscribe: true, maxRetries: 1, websocketTimeout: 10000, peerConnectionTimeout: 10000 });
      if (this.stopped) return;
      await this.poll();
    } catch (error) {
      if (this.stopped) return;
      this.emit({ phase: 'error', track: null, micEnabled: false, message: emergencyError(error) });
      await this.disconnect();
    }
  }
  async poll() {
    clearTimeout(this.timer);
    if (this.stopped || !this.session || this.polling) return;
    this.polling = true;
    try {
      const session = await this.call(`/api/v1/media-sessions/${this.session.sessionId}`);
      if (this.stopped) return;
      if (!matchesIncidentMedia(session, this.incident, this.account) || !openCameraSession(session)) {
        this.acquired = false;
        this.emit({ session, phase: 'ended', track: null, micEnabled: false, message: 'Phiên camera đã kết thúc hoặc đổi người phụ trách.' });
        await this.disconnect(); return;
      }
      this.session = session; this.emit({ session, checkedAt: Date.now() });
    } catch (error) {
      if (this.stopped) return;
      this.emit({ checkedAt: 0, message: 'Chưa kiểm tra được trạng thái camera. Tạm khóa xác nhận.' });
      if ([401, 403, 404].includes(error.status)) {
        this.acquired = false; this.emit({ phase: 'error', track: null }); await this.disconnect(); return;
      }
    } finally { this.polling = false; }
    if (!this.stopped) this.timer = setTimeout(() => this.poll(), 3000);
  }
  async toggleMicrophone() {
    if (incidentMediaMode(this.incident) !== 'ASSIST' || !this.room || this.micBusy || this.stopped) return;
    this.micBusy = true;
    try {
      const enabled = !this.state.micEnabled;
      await this.room.localParticipant.setMicrophoneEnabled(enabled);
      this.emit({ micEnabled: enabled, message: enabled ? 'Micro đang bật để trao đổi với người cần hỗ trợ.' : 'Đã tắt micro.' });
    } catch { this.emit({ message: 'Không mở được micro. Hãy kiểm tra quyền micro của trình duyệt.' }); }
    finally { this.micBusy = false; }
  }
  async disconnect() {
    const room = this.room; this.room = null;
    if (room) { room.removeAllListeners(); await Promise.resolve(room.disconnect()).catch(() => {}); }
  }
  stop() {
    if (this.stopping) return this.stopping;
    this.stopped = true; this.abort.abort(); clearTimeout(this.timer);
    this.stopping = (async () => {
      // A create/accept may complete after the panel has unmounted.
      await this.pending?.catch(() => {});
      await this.disconnect();
      const session = this.session;
      if (this.acquired && matchesIncidentMedia(session, this.incident, this.account) && openCameraSession(session)) {
        await this.request(`/api/v1/media-sessions/${session.sessionId}/end`, { method: 'POST', body: { reason: 'INCIDENT_VIEW_CLOSED' }, keepalive: true }).catch(() => {});
      }
    })();
    closing.set(this.key, this.stopping);
    this.stopping.finally(() => { if (closing.get(this.key) === this.stopping) closing.delete(this.key); });
    return this.stopping;
  }
}

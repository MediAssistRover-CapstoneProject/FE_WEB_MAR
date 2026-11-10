const openStates = new Set(['RINGING', 'CONNECTING', 'ACTIVE', 'RECONNECTING']);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const openCameraSession = (session, now = Date.now()) => uuid.test(session?.sessionId || '') && openStates.has(session.state) && Date.parse(session.expiresAt) > now;
export const ownMonitorSession = (session, robotId, accountId) => session?.robotId === robotId && session.mode === 'MONITOR' && !session.incidentId && session.staffAccountId === accountId;

export function cameraError(error) {
  return ({
    MEDIA_DISABLED: 'Máy chủ chưa bật dịch vụ camera trực tiếp.',
    MEDIA_DEVICE_NOT_CONNECTED: 'Robot chưa kết nối dịch vụ camera. Trang sẽ tự kiểm tra lại.',
    ROBOT_MEDIA_SESSION_ALREADY_OPEN: 'Robot đang có phiên camera khác. Trang sẽ kiểm tra lại.',
    MEDIA_SERVER_UNAVAILABLE: 'Chưa kết nối được máy chủ camera. Trang sẽ tự thử lại.',
    MEDIA_CONFIGURATION_INVALID: 'Cấu hình dịch vụ camera trên máy chủ chưa đầy đủ.',
    MEDIA_EXTERNAL_WSS_ORIGIN_REQUIRED: 'Máy chủ chưa cấu hình địa chỉ camera bảo mật.',
  })[error?.message] || (error?.status === 403 ? 'Tài khoản chưa có quyền xem phiên camera này.'
    : error?.status === 401 ? 'Phiên đăng nhập đã hết hạn.' : 'Chưa kết nối được camera. Trang sẽ tự thử lại.');
}

// No local tracks are created: MONITOR only subscribes to this robot's video.
// Dependencies are injected so lifecycle and API scope can be tested without a robot.
export class RobotCameraConnection {
  constructor({ robotId, account, request, loadSdk }) {
    Object.assign(this, { robotId, account, request, loadSdk });
    this.listeners = new Set(); this.abort = new AbortController();
    this.state = { phase: 'connecting', message: 'Đang kết nối camera robot…', track: null };
    this.stopped = false; this.connecting = false; this.session = null; this.owned = false;
  }
  subscribe(listener) { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  emit(patch) {
    if (this.stopped) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener(this.state));
  }
  call(path, options = {}) { return this.request(path, { signal: this.abort.signal, ...options }); }
  start() { return this.connect(); }
  schedule(fn, delay) { clearTimeout(this.timer); if (!this.stopped) this.timer = setTimeout(() => fn.call(this), delay); }
  async disconnect() {
    const room = this.room; this.room = null;
    if (room) { room.removeAllListeners(); await Promise.resolve(room.disconnect()).catch(() => {}); }
  }
  async end(session, keepalive = false) {
    if (!ownMonitorSession(session, this.robotId, this.account.accountId)) return;
    await this.request(`/api/v1/media-sessions/${session.sessionId}/end`, { method: 'POST', body: { reason: 'MONITOR_VIEW_CLOSED' }, retry: false, keepalive }).catch(() => {});
  }
  async stop({ keepalive = false } = {}) {
    if (this.stopped) return;
    this.stopped = true; this.abort.abort(); clearTimeout(this.timer);
    this.listeners.clear();
    await this.disconnect();
    if (this.creation) await this.creation.catch(() => {});
    const session = this.owned ? this.session : null;
    this.owned = false;
    if (session) await this.end(session, keepalive);
  }
  retry() { if (!this.connecting && !this.stopped) { clearTimeout(this.timer); return this.connect(); } }
  async connect() {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    try {
      await this.disconnect();
      this.emit({ phase: 'connecting', track: null, message: 'Đang kết nối camera robot…' });
      const configuration = await this.call('/api/v1/media/configuration');
      if (this.stopped) return;
      if (configuration?.enabled !== true) {
        this.emit({ phase: 'unavailable', message: 'Máy chủ chưa bật dịch vụ camera trực tiếp.' });
        this.schedule(this.connect, 30000); return;
      }
      const sessions = await this.call('/api/v1/media-sessions');
      if (this.stopped) return;
      if (!Array.isArray(sessions)) throw Error('Invalid media session list');
      let session = sessions.find(value => value.robotId === this.robotId && openCameraSession(value));
      this.owned = this.owned && session?.sessionId === this.session?.sessionId;
      if (session && !ownMonitorSession(session, this.robotId, this.account.accountId)) {
        this.emit({ phase: 'busy', message: session.mode === 'ASSIST' ? 'Robot đang có phiên hỗ trợ/SOS. Camera được ưu tiên cho người đang hỗ trợ.' : 'Camera đang được tài khoản khác sử dụng.' });
        this.schedule(this.connect, 10000); return;
      }
      if (!session) {
        if (this.account.role !== 'ADMIN') {
          this.emit({ phase: 'restricted', message: 'Cần quản trị viên mở phiên xem camera. Phiên hỗ trợ được quản lý trong phần SOS.' }); return;
        }
        // Do not abort a create after sending it: its response may be needed to
        // close the newly created MONITOR session if the view has just unmounted.
        this.creation = this.call('/api/v1/media-sessions', { method: 'POST', body: { robotId: this.robotId, mode: 'MONITOR' }, retry: false, signal: undefined });
        session = await this.creation;
        if (!ownMonitorSession(session, this.robotId, this.account.accountId) || !openCameraSession(session)) throw Error('Invalid monitor session');
        this.owned = true; this.session = session;
        if (this.stopped) return;
      }
      this.session = session;
      // Accept is deliberately not called here: accepting ASSIST can stop jobs.
      const credentials = await this.call(`/api/v1/media-sessions/${session.sessionId}/join-token`, { method: 'POST', body: {}, retry: false });
      if (this.stopped) return;
      const url = new URL(credentials?.url);
      if (!ownMonitorSession(credentials?.session, this.robotId, this.account.accountId)
        || credentials.session.sessionId !== session.sessionId || !openCameraSession(credentials.session)
        || credentials.room !== `mar-${session.sessionId}` || credentials.identity !== `staff-${this.account.accountId}`
        || url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash
        || !credentials.token || !Number.isFinite(Date.parse(credentials.expiresAt)) || Date.parse(credentials.expiresAt) <= Date.now()) throw Error('Invalid camera credentials');
      const sdk = await this.loadSdk();
      if (this.stopped) return;
      const room = new sdk.Room({ adaptiveStream: true, dynacast: true }); this.room = room;
      const current = () => !this.stopped && this.room === room;
      room.on(sdk.RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (current() && participant.identity === `robot-${this.robotId}` && track.kind === sdk.Track.Kind.Video
          && publication.source === sdk.Track.Source.Camera) this.emit({ phase: 'live', message: 'Đang nhận camera robot.', track });
      });
      room.on(sdk.RoomEvent.TrackUnsubscribed, track => {
        if (current() && this.state.track === track) this.emit({ phase: 'waiting', track: null, message: 'Đang chờ camera robot gửi hình…' });
      });
      room.on(sdk.RoomEvent.TrackMuted, publication => {
        if (current() && publication.track === this.state.track) this.emit({ phase: 'waiting', message: 'Camera robot đang tạm dừng gửi hình.' });
      });
      room.on(sdk.RoomEvent.TrackUnmuted, publication => {
        if (current() && publication.track === this.state.track) this.emit({ phase: 'live', message: 'Đang nhận camera robot.' });
      });
      room.on(sdk.RoomEvent.Reconnecting, () => { if (current()) this.emit({ phase: 'reconnecting', message: 'Đang kết nối lại camera…' }); });
      room.on(sdk.RoomEvent.Reconnected, () => { if (current()) this.emit({ phase: this.state.track ? 'live' : 'waiting', message: 'Đã kết nối lại; chờ hình từ robot.' }); });
      room.on(sdk.RoomEvent.Disconnected, reason => {
        if (!current()) return;
        const duplicate = sdk.DisconnectReason?.DUPLICATE_IDENTITY !== undefined && reason === sdk.DisconnectReason.DUPLICATE_IDENTITY;
        clearTimeout(this.timer);
        if (duplicate) this.owned = false;
        this.emit({ phase: duplicate ? 'restricted' : 'error', track: null, message: duplicate ? 'Camera đã được mở ở cửa sổ khác của tài khoản này.' : 'Kết nối camera đã gián đoạn. Đang kiểm tra lại phiên.' });
        if (!duplicate) this.schedule(this.connect, 10000);
      });
      this.emit({ phase: 'waiting', message: 'Đã mở phiên xem; đang chờ camera robot…' });
      await room.connect(credentials.url, credentials.token, { autoSubscribe: true, maxRetries: 1, peerConnectionTimeout: 10000, websocketTimeout: 10000 });
      if (this.stopped) { await this.disconnect(); return; }
      this.schedule(this.poll, 5000);
    } catch (error) {
      if (this.stopped) return;
      await this.disconnect();
      this.emit({ phase: error.status === 401 || error.status === 403 ? 'restricted' : 'error', track: null, message: cameraError(error) });
      if (![401, 403].includes(error.status)) this.schedule(this.connect, 10000);
    } finally { this.connecting = false; }
  }
  async poll() {
    if (this.stopped || !this.session) return;
    try {
      if (!openCameraSession(this.session)) {
        this.owned = false; this.session = null; await this.disconnect();
        this.emit({ phase: 'waiting', track: null, message: 'Phiên xem camera đã hết hạn. Đang kết nối phiên mới.' });
        this.schedule(this.connect, 10000); return;
      }
      const session = await this.call(`/api/v1/media-sessions/${this.session.sessionId}`);
      if (this.stopped) return;
      if (!ownMonitorSession(session, this.robotId, this.account.accountId) || !openCameraSession(session)) {
        this.owned = false; this.session = null;
        await this.disconnect();
        this.emit({ phase: 'waiting', track: null, message: 'Phiên camera đã kết thúc. Đang kiểm tra phiên mới.' });
        this.schedule(this.connect, 10000); return;
      }
      this.session = session;
    } catch (error) {
      if (this.stopped) return;
      if ([401, 403, 404].includes(error.status)) {
        await this.disconnect(); this.emit({ phase: 'restricted', track: null, message: cameraError(error) }); return;
      }
      this.emit({ message: 'Chưa đọc được trạng thái phiên. Đang kiểm tra lại kết nối camera.' });
    }
    this.schedule(this.poll, 5000);
  }
}

import { mergeJobDetail, TERMINAL_STATUSES } from './liveOperations.js';

// One in-flight read and one stream per job, shared by the mission card and
// explorer. Background reads retain the last complete detail throughout.
export class JobFeed {
  constructor(jobId, { read, watch, now = Date.now, pollInterval = 15000 }) {
    Object.assign(this, { jobId, read, watch, now, pollInterval });
    this.value = { detail: null, error: '', loading: true, receivedAt: null, liveStatus: '' };
    this.listeners = new Set(); this.generation = 0;
    this.retryDelay = 5000;
  }
  get finished() {
    const job = this.value.detail?.job;
    return TERMINAL_STATUSES.includes(job?.status) && !['PENDING', 'RECOVERY_REQUIRED'].includes(job.stopStatus);
  }
  subscribe(listener) { this.listeners.add(listener); listener(this.value); return () => this.listeners.delete(listener); }
  emit(patch) {
    if (this.stopped) return;
    this.value = { ...this.value, ...patch }; this.listeners.forEach(listener => listener(this.value));
  }
  accept(next) {
    if (this.stopped || next?.job?.jobId !== this.jobId) return;
    const previous = this.value.detail;
    const merged = mergeJobDetail(previous, next);
    const detail = JSON.stringify(previous) === JSON.stringify(merged) ? previous : merged;
    if (merged.job !== next.job) {
      if (detail !== previous) this.emit({ detail });
      return;
    }
    this.generation++;
    this.emit({ detail, error: '', loading: false, receivedAt: this.now() });
    if (this.finished) { this.stream?.abort(); clearTimeout(this.retryTimer); clearTimeout(this.pollTimer); this.emit({ liveStatus: '' }); }
    return detail;
  }
  refresh() {
    if (this.stopped) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    const controller = new AbortController(), generation = this.generation;
    this.request = controller;
    this.inFlight = (async () => {
      try {
        const next = await this.read(this.jobId, controller.signal);
        if (!controller.signal.aborted && (generation === this.generation || next?.job?.rowVersion > this.value.detail?.job?.rowVersion)) {
          if (next?.job?.jobId !== this.jobId) throw Error('Chi tiết trả về không đúng công việc.');
          this.accept(next);
        }
      } catch (error) { if (!controller.signal.aborted && generation === this.generation) this.emit({ error: error.message || 'Không tải được chi tiết.', loading: false }); }
      finally { this.inFlight = null; this.request = null; }
    })();
    return this.inFlight;
  }
  observe(job) {
    const known = this.value.detail?.job;
    if (Number(job?.rowVersion) < Number(known?.rowVersion)) return;
    if (!known || Number(job?.rowVersion) > Number(known.rowVersion)
      || (job?.status && job.status !== known.status)
      || (job && 'stopStatus' in job && job.stopStatus !== known.stopStatus)
      || (job && 'selectedJobStepId' in job && job.selectedJobStepId !== known.selectedJobStepId)) this.refresh();
  }
  setAuto(enabled) {
    if (this.auto === enabled) return;
    this.auto = enabled; clearTimeout(this.pollTimer);
    if (!enabled) { this.stream?.abort(); this.stream = null; clearTimeout(this.retryTimer); this.emit({ liveStatus: '' }); return; }
    if (this.finished) return;
    this.connect();
    const poll = () => {
      if (this.stopped || !this.auto || this.finished) return;
      if (this.stream && this.now() - (this.lastStreamAt ?? this.streamOpenedAt) > 30000) this.stream.abort();
      if (!this.stream || this.lastStreamAt == null || this.now() - this.lastStreamAt > 20000) this.refresh();
      this.pollTimer = setTimeout(poll, this.pollInterval);
    };
    this.pollTimer = setTimeout(poll, this.pollInterval);
  }
  async connect() {
    if (this.stopped || !this.auto || this.stream || this.finished) return;
    const controller = new AbortController(); this.stream = controller;
    this.streamOpenedAt = this.now(); this.lastStreamAt = null;
    this.emit({ liveStatus: 'Đang kết nối trực tiếp…' });
    try {
      await this.watch(this.jobId, { signal: controller.signal, onEvent: event => {
        if (controller.signal.aborted || event.type !== 'job-state' || !event.data?.job?.status) return;
        if (!this.accept(event.data)) return;
        this.lastStreamAt = this.now(); this.retryDelay = 5000;
        if (!this.finished) this.emit({ liveStatus: 'Đang theo dõi trực tiếp' });
      } });
    } catch { /* Snapshot polling remains available while reconnecting. */ }
    finally {
      if (this.stream === controller) {
        this.stream = null;
        if (!this.stopped && this.auto && !this.finished) {
          this.emit({ liveStatus: `Kết nối trực tiếp gián đoạn · làm mới mỗi ${this.pollInterval / 1000} giây` });
          if (this.lastStreamAt != null) {
            const generation = this.generation;
            // An in-flight GET may predate the last frame and be discarded.
            const resync = () => {
              if (!this.stopped && this.auto && !this.finished && generation === this.generation) this.refresh();
            };
            if (this.inFlight) this.inFlight.then(resync);
            else resync();
          }
          this.retryTimer = setTimeout(() => this.connect(), this.retryDelay);
          this.retryDelay = Math.min(this.retryDelay * 2, 30000);
        }
      }
    }
  }
  stop() { this.stopped = true; this.request?.abort(); this.stream?.abort(); clearTimeout(this.pollTimer); clearTimeout(this.retryTimer); this.listeners.clear(); }
}

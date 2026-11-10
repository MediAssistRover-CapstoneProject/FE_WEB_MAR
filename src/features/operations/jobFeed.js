import { mergeJobDetail, TERMINAL_STATUSES } from './liveOperations.js';

// One in-flight read and one stream per job, shared by the mission card and
// explorer. Background reads retain the last complete detail throughout.
export class JobFeed {
  constructor(jobId, { read, watch, now = Date.now }) {
    Object.assign(this, { jobId, read, watch, now });
    this.value = { detail: null, error: '', loading: true, receivedAt: null, liveStatus: '' };
    this.listeners = new Set(); this.generation = 0; this.lastStreamAt = 0;
  }
  subscribe(listener) { this.listeners.add(listener); listener(this.value); return () => this.listeners.delete(listener); }
  emit(patch) {
    if (this.stopped) return;
    this.value = { ...this.value, ...patch }; this.listeners.forEach(listener => listener(this.value));
  }
  accept(next) {
    if (this.stopped || next?.job?.jobId !== this.jobId) return;
    this.generation++;
    const merged = mergeJobDetail(this.value.detail, next);
    const detail = JSON.stringify(this.value.detail) === JSON.stringify(merged) ? this.value.detail : merged;
    this.emit({ detail, error: '', loading: false, receivedAt: this.now() });
    if (TERMINAL_STATUSES.includes(detail.job.status)) { this.stream?.abort(); clearTimeout(this.retryTimer); clearTimeout(this.pollTimer); this.emit({ liveStatus: '' }); }
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
        if (!controller.signal.aborted && generation === this.generation) {
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
    if (!known || Number(job?.rowVersion) > Number(known.rowVersion)
      || job?.status !== known.status || job?.selectedJobStepId !== known.selectedJobStepId) this.refresh();
  }
  setAuto(enabled) {
    if (this.auto === enabled) return;
    this.auto = enabled; clearTimeout(this.pollTimer);
    if (!enabled) { this.stream?.abort(); clearTimeout(this.retryTimer); this.emit({ liveStatus: '' }); return; }
    if (TERMINAL_STATUSES.includes(this.value.detail?.job.status)) return;
    this.connect();
    const poll = () => {
      if (this.stopped || !this.auto) return;
      if (this.stream && this.now() - Math.max(this.lastStreamAt, this.streamOpenedAt || 0) > 30000) this.stream.abort();
      if (!TERMINAL_STATUSES.includes(this.value.detail?.job.status) && this.now() - this.lastStreamAt > 20000) this.refresh();
      this.pollTimer = setTimeout(poll, 15000);
    };
    this.pollTimer = setTimeout(poll, 15000);
  }
  async connect() {
    if (this.stopped || !this.auto || this.stream || TERMINAL_STATUSES.includes(this.value.detail?.job.status)) return;
    const controller = new AbortController(); this.stream = controller;
    this.streamOpenedAt = this.now();
    this.emit({ liveStatus: 'Đang kết nối trực tiếp…' });
    try {
      await this.watch(this.jobId, { signal: controller.signal, onEvent: event => {
        if (controller.signal.aborted || event.type !== 'job-state' || event.data?.job?.jobId !== this.jobId) return;
        this.lastStreamAt = this.now(); this.accept(event.data);
        if (!TERMINAL_STATUSES.includes(this.value.detail?.job.status)) this.emit({ liveStatus: 'Đang theo dõi trực tiếp' });
      } });
    } catch { /* Snapshot polling remains available while reconnecting. */ }
    finally {
      if (this.stream === controller) this.stream = null;
      if (!this.stopped && this.auto && !TERMINAL_STATUSES.includes(this.value.detail?.job.status)) {
        this.emit({ liveStatus: 'Kết nối trực tiếp gián đoạn · vẫn làm mới mỗi 15 giây' });
        this.retryTimer = setTimeout(() => this.connect(), 5000);
      }
    }
  }
  stop() { this.stopped = true; this.request?.abort(); this.stream?.abort(); clearTimeout(this.pollTimer); clearTimeout(this.retryTimer); this.listeners.clear(); }
}

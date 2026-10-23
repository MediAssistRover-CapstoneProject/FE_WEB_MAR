export const terminalJobs = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'EXPIRED']);
export const jobLabels = { QUEUED: 'Đang chờ robot', ACCEPTED: 'Robot đã nhận nhiệm vụ', RUNNING: 'Đang thực hiện', SUCCEEDED: 'Hoàn tất', FAILED: 'Thất bại', CANCELLED: 'Đã hủy', TIMED_OUT: 'Hết thời gian', EXPIRED: 'Đã hết hạn', RECOVERY_REQUIRED: 'Cần khôi phục' };
export const receiptLabels = { QUEUED: 'Máy chủ đã nhận yêu cầu', MQTT_PUBLISHED: 'Đã gửi, đang chờ Pi xác nhận', PI_ACCEPTED: 'Pi đã chấp nhận lệnh', PI_REJECTED: 'Pi từ chối lệnh', NO_PI_ACK: 'Không nhận được xác nhận từ Pi', PUBLISH_FAILED: 'Không gửi được lệnh đến Pi' };
export const rejectedReceipts = new Set(['PI_REJECTED', 'NO_PI_ACK', 'PUBLISH_FAILED']);
export const isOperator = session => session?.mode !== 'demo' && session?.account?.role === 'ADMIN' && Boolean(session?.tokens?.accessToken);
export function eligibleWorkflows(details, type) {
  return details.filter(d => {
    const w = d.workflow;
    if (!w || w.schemaVersion !== 3 || w.serviceType !== type || w.status !== 'PUBLISHED' || !w.acceptsNewJobs || !w.definitionHash) return false;
    if (type !== 'SPEECH') return true;
    const steps = (d.steps || []).filter(s => s.enabled);
    return steps.length > 0 && steps.every(s => s.stepTypeCode === 'INTERACT' && s.paramsJson?.action === 'SPEAK');
  }).map(d => d.workflow);
}
export function movementBlock({ operator, detail, session, snapshot, checkedAt, saving, now = Date.now() }) {
  if (!operator) return 'Chỉ quản trị viên đăng nhập thật mới được điều khiển.';
  if (saving) return 'Đang lưu và kết thúc phiên quét.';
  if (!checkedAt || now - checkedAt > 2500) return 'Chưa có trạng thái kết nối mới. Đang khóa điều khiển.';
  if (!snapshot?.mqttConnected || !snapshot.heartbeatFresh || !snapshot.dispatchReady) return 'Pi chưa sẵn sàng. Kiểm tra kết nối robot.';
  const job = detail?.job;
  if (job?.status === 'RECOVERY_REQUIRED') return 'Cần kiểm tra và khôi phục nhiệm vụ trước khi tiếp tục.';
  if (job?.status !== 'RUNNING' || job.cancelRequestedAt || session?.job_status !== 'RUNNING' || session?.state !== 'MAPPING' || !session.potentially_open) return 'Chờ nhiệm vụ vào bước quét đang hoạt động.';
  const step = detail.steps?.find(s => s.jobStepId === job.selectedJobStepId);
  if (step?.status !== 'RUNNING' || step.stepTypeSnapshot !== 'WAIT' || step.resolvedInputsJson?.event_type !== 'MAPPING_SAVE_REQUESTED') return 'Robot chưa ở bước cho phép điều khiển quét.';
  return '';
}
export function committedMapId(detail) {
  if (detail?.job?.status !== 'SUCCEEDED') return '';
  return detail.steps?.find(s => s.resolvedInputsJson?.service_key === 'COMMIT_MAP_ARTIFACT' && s.status === 'SUCCEEDED')?.resultJson?.data?.map_id || '';
}
export function friendlyError(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 'Kết nối hết thời gian chờ. Tải lại trạng thái để kiểm tra kết quả trước khi gửi lại.';
  if (error?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error?.status === 403) return 'Tài khoản không có quyền thực hiện thao tác này.';
  if (!error?.status) return 'Không kết nối được máy chủ. Kiểm tra kết nối và tải lại trạng thái.';
  return 'Máy chủ từ chối thao tác. Kiểm tra trạng thái robot và nhiệm vụ trong phần chi tiết.';
}

// Only one short pulse is in flight. Generation + sequence fences prevent a
// late HTTP response from restarting a stopped control loop.
export class MappingJog {
  constructor({ send, allowed, onState = () => {}, clock = () => Date.now() }) {
    Object.assign(this, { send, allowed, onState, clock, active: false, generation: 0, commandIds: new Set() });
  }
  start(x, z, seconds) {
    if (this.active) return;
    const reason = this.allowed();
    if (reason) throw Error(reason);
    if (!Number.isFinite(seconds) || seconds < 0.4 || seconds > 10 || !Number.isFinite(x) || x < 0 || x > 0.1 || !Number.isFinite(z) || Math.abs(z) > 0.3) throw Error('Tốc độ hoặc thời gian chạy không hợp lệ.');
    this.active = true; this.commandIds.clear();
    const generation = ++this.generation;
    this.onState('Đang gửi lệnh ngắn; nhả nút để dừng.');
    this.deadline = setTimeout(() => this.stop('Đã hết thời gian chạy.').catch(() => {}), seconds * 1000);
    void this.renew(x, z, generation);
  }
  async renew(x, z, generation) {
    if (!this.active || generation !== this.generation) return;
    const reason = this.allowed();
    if (reason) { await this.stop(reason).catch(() => {}); return; }
    const started = this.clock();
    try {
      const receipt = await this.send(x, z);
      if (!this.active || generation !== this.generation) return;
      if (receipt?.commandId) this.commandIds.add(receipt.commandId);
      this.onState('Đang gia hạn lệnh ngắn. Nhả nút hoặc bấm Dừng.', receipt);
      if (rejectedReceipts.has(receipt?.status)) { await this.stop(receiptLabels[receipt.status]).catch(() => {}); return; }
      this.timer = setTimeout(() => this.renew(x, z, generation), Math.max(0, 300 - (this.clock() - started)));
    } catch (error) {
      if (this.active && generation === this.generation) await this.stop(friendlyError(error)).catch(() => {});
    }
  }
  acknowledge(receipt) {
    if (this.active && this.commandIds.has(receipt?.commandId) && rejectedReceipts.has(receipt.status)) void this.stop(receiptLabels[receipt.status]).catch(() => {});
  }
  async stop(message = 'Đã ngừng gia hạn và gửi yêu cầu dừng.') {
    this.active = false;
    const generation = ++this.generation;
    clearTimeout(this.timer); clearTimeout(this.deadline);
    this.onState(message);
    try {
      const receipt = await this.send(0, 0);
      if (generation === this.generation) this.onState(message, receipt);
      return receipt;
    } catch (error) {
      if (generation === this.generation) this.onState('Đã ngừng gia hạn; chưa xác nhận được lệnh dừng. Các xung đã gửi sẽ tự hết hạn.');
      throw error;
    }
  }
}

import { useEffect, useRef, useState } from 'react';
import { patrolApi } from '../../../features/patrol/patrolApi.js';
import { scheduleTime } from '../../../features/patrol/patrolModel.js';
import { Button, Modal } from './PatrolUi.jsx';

const statuses = { ACTIVE: 'Đang kích hoạt', PAUSED: 'Tạm dừng', RETIRED: 'Đã ngừng sử dụng' };

export default function PatrolScheduleDialog({ scheduleId, retiring, writable, onClose, onRetired }) {
  const [schedule, setSchedule] = useState(null), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [reason, setReason] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setSchedule(null); setError('');
    patrolApi.getSchedule(scheduleId, { signal: controller.signal }).then(value => {
      if (value?.scheduleId !== scheduleId) throw new Error('Máy chủ chưa trả đúng lịch đã chọn.');
      if (!controller.signal.aborted) setSchedule(value);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [scheduleId, revision]);

  const canRetire = writable && retiring && ['PAUSED', 'ACTIVE'].includes(schedule?.status) && reason.trim().length >= 5;
  const retire = async () => {
    if (lock.current || !canRetire) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await patrolApi.retireSchedule(scheduleId, reason.trim());
      if (result?.scheduleId !== scheduleId || result.status !== 'RETIRED') throw new Error('Chưa xác nhận được trạng thái lịch.');
      onRetired();
    } catch (cause) {
      // A timeout can follow a successful retirement. Read the record before offering another write.
      try {
        const latest = await patrolApi.getSchedule(scheduleId);
        if (latest?.scheduleId !== scheduleId) throw new Error();
        if (latest.status === 'RETIRED') { onRetired(); return; }
        setSchedule(latest);
      } catch { setSchedule(null); }
      setError(cause.message);
    } finally { lock.current = false; setBusy(false); }
  };

  return <Modal title={retiring ? 'Ngừng sử dụng lịch' : 'Chi tiết lịch tuần tra'} onClose={onClose} busy={busy}>
    <div className="pt-form-body">
      {schedule ? <>
        <h4>{schedule.scheduleName}</h4>
        <dl className="pt-review-list">
          <div><dt>Mã lịch</dt><dd>{schedule.scheduleCode}</dd></div>
          <div><dt>Trạng thái</dt><dd>{statuses[schedule.status] || schedule.status}</dd></div>
          <div><dt>Kiểu lịch</dt><dd>{schedule.scheduleType === 'ONCE' ? 'Một lần' : schedule.scheduleType === 'INTERVAL' ? `Mỗi ${schedule.intervalSec} giây` : schedule.cronExpression}</dd></div>
          <div><dt>Múi giờ của lịch</dt><dd>{schedule.timezone}</dd></div>
          <div><dt>Bắt đầu</dt><dd>{scheduleTime(schedule.startsAt, schedule.timezone)}</dd></div>
          <div><dt>Lượt tiếp theo</dt><dd>{scheduleTime(schedule.nextRunAt, schedule.timezone)}</dd></div>
        </dl>
        {retiring && schedule.status !== 'RETIRED' && <>
          <p>Lịch sẽ ngừng tạo lượt mới. Các nhiệm vụ đã vào hàng đợi tiếp tục theo trạng thái hiện tại.</p>
          <label className="pt-field">Lý do ngừng sử dụng (5–500 ký tự)
            <textarea minLength={5} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)}/>
          </label>
        </>}
      </> : !error && <p role="status">Đang đọc lịch…</p>}
      {error && <div className="pt-alert" role="alert">{error} <Button onClick={() => setRevision(value => value + 1)}>Đọc lại lịch</Button></div>}
    </div>
    <footer className="pt-dialog-footer"><Button onClick={onClose} disabled={busy}>Đóng</Button>
      {retiring && schedule?.status !== 'RETIRED' && <Button tone="danger" disabled={busy || !canRetire} onClick={retire}>{busy ? 'Đang lưu…' : 'Xác nhận ngừng sử dụng'}</Button>}
    </footer>
  </Modal>;
}

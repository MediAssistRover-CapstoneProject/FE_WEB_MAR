import { useState } from 'react';
import { stepSummary } from '../../../features/operations/liveOperations.js';
import { vi } from '../../../i18n/vi.js';
import RecordDetails from '../backend/RecordDetails.jsx';

const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : null;
const present = value => value !== null && value !== undefined && value !== '';

function Facts({ rows }) {
  return <dl className="lo-readable-facts">{rows.filter(([, value]) => present(value)).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}

export function StepDetails({ step, catalogs }) {
  const summary = stepSummary(step, catalogs);
  return <Facts rows={[
    ['Điểm đến', summary.target],
    ['Kết quả', summary.outcome],
    ['Bắt đầu', timestamp(summary.startedAt)],
    ['Kết thúc', timestamp(summary.endedAt)],
    ['Thời gian thực hiện', summary.duration],
    ['Giới hạn chờ', summary.timeout],
    ['Số lần thử', summary.attempts],
    ['Nội dung yêu cầu', summary.instruction],
    ['Nguyên nhân lỗi', summary.issue],
    ['Lý do gián đoạn', summary.interruption],
    ['Yêu cầu gián đoạn lúc', timestamp(summary.interruptedAt)],
  ]} />;
}

export function TechnicalDetails({ value, title = 'Thông tin kỹ thuật' }) {
  const [open, setOpen] = useState(false);
  return <details className="lo-raw-details" onToggle={event => setOpen(event.currentTarget.open)}><summary>{title}</summary>{open && <RecordDetails value={value} />}</details>;
}

export function EventDetails({ event, steps }) {
  const step = steps?.find(item => item.jobStepId === event.jobStepId);
  const producer = { ADMIN: 'Quản trị viên', STAFF: 'Nhân viên', ROBOT: 'Robot', DEVICE: 'Thiết bị', SYSTEM: 'Hệ thống', SERVER: 'Máy chủ', BE: 'Máy chủ' }[event.producerType];
  return <>
    <Facts rows={[
      ['Thời điểm', timestamp(event.occurredAt || event.receivedAt)],
      ['Nguồn ghi nhận', producer],
      ['Bước liên quan', step && `${vi(step.stepTypeSnapshot)} · ${step.stepCodeSnapshot}`],
    ]} />
    <TechnicalDetails value={event} title="Dữ liệu kỹ thuật của sự kiện" />
  </>;
}

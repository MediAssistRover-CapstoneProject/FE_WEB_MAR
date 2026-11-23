import { useEffect, useId, useMemo, useState } from 'react';
import { OPEN_PATROL_STATUSES, jobStatus, jobStopPending } from '../../../features/patrol/patrolModel.js';
import PatrolJobMonitor from './PatrolJobMonitor.jsx';
import { Button, Empty, Icon } from './PatrolUi.jsx';
import './patrolQueue.css';

const TABS = [
  { id: 'open', label: 'Đang mở', statuses: OPEN_PATROL_STATUSES, empty: 'Chưa có lượt tuần tra đang mở', description: 'Các lượt đang chờ, thực hiện hoặc tạm dừng sẽ xuất hiện tại đây.' },
  { id: 'waiting', label: 'Chờ robot', statuses: new Set(['QUEUED', 'ACCEPTED']), empty: 'Không có lượt đang chờ robot', description: 'Lượt đã được hệ thống tiếp nhận và chờ robot thực hiện. Thứ tự chạy do hệ thống điều phối.' },
  { id: 'running', label: 'Đang chạy', statuses: new Set(['RUNNING']), empty: 'Chưa có robot đang tuần tra', description: 'Theo dõi lượt robot đang thực hiện và chọn một lượt để xem tiến độ.' },
  { id: 'paused', label: 'Tạm dừng', statuses: new Set(['SUSPENDING', 'SUSPENDED', 'RECOVERY_REQUIRED']), empty: 'Không có lượt đang tạm dừng', description: 'Robot có thể đang nhường SOS, giao tiếp hoặc chờ kiểm tra trước khi tiếp tục.' },
  { id: 'ended', label: 'Đã kết thúc', statuses: new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']), empty: 'Chưa có lượt tuần tra đã kết thúc', description: 'Xem lại kết quả của các lượt đã hoàn thành, không hoàn thành hoặc được kết thúc.' },
];

const shortId = value => String(value || '').slice(0, 8);
const robotName = robot => robot?.robotName || robot?.robotCode;
const dateTime = value => {
  const instant = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(instant) ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(instant) : 'Chưa ghi nhận';
};

const matchesTab = (tab, job) => jobStopPending(job) ? ['open', 'paused'].includes(tab.id) : tab.statuses.has(job.status);

export default function PatrolQueuePanel({
  jobs = [], historyJobs = [], loading = false, error = '', historyLoading = false,
  historyError = '', updatedAt, catalog = {}, selectedId = '', detail = null,
  detailError = '', writable = false, onSelect, onAction, onRefresh,
}) {
  const [tabId, setTabId] = useState('open');
  const [robotId, setRobotId] = useState('');
  const groupId = useId();
  const robots = catalog.robots || [];
  const workflows = catalog.workflows || [];
  const tab = TABS.find(item => item.id === tabId) || TABS[0];
  const selected = detail?.job?.jobId === selectedId ? detail : null;
  const combined = useMemo(() => {
    const merged = new Map([...jobs, ...historyJobs].filter(job => job?.jobId).map(job => [job.jobId, job]));
    if (selected?.job) {
      const listed = merged.get(selected.job.jobId);
      if (!listed || !(Number(listed.rowVersion) > Number(selected.job.rowVersion))) merged.set(selected.job.jobId, selected.job);
    }
    return [...merged.values()].sort((a, b) => (b.queuedAt || '').localeCompare(a.queuedAt || '') || String(a.jobId).localeCompare(String(b.jobId)));
  }, [jobs, historyJobs, selected]);
  const scoped = combined.filter(job => !robotId || job.robotId === robotId);
  const visible = scoped.filter(job => matchesTab(tab, job));
  const listLoading = tabId === 'ended' ? historyLoading : loading;
  const listError = tabId === 'ended' ? historyError : error;
  const robotOptions = useMemo(() => {
    const options = new Map(robots.map(robot => [robot.robotId, robotName(robot) || `Robot ${shortId(robot.robotId)}`]));
    for (const job of combined) if (job.robotId && !options.has(job.robotId)) options.set(job.robotId, `Robot ${shortId(job.robotId)}`);
    return [...options].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [robots, combined]);
  useEffect(() => { if (robotId && !robotOptions.some(([id]) => id === robotId)) setRobotId(''); }, [robotOptions, robotId]);
  const switchTab = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = TABS.findIndex(item => item.id === tabId);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    const next = TABS[index].id;
    setTabId(next);
    event.currentTarget.querySelector(`[data-queue-tab="${next}"]`)?.focus();
  };
  return <section className="pt-card pt-queue" id="patrol-queue" aria-label="Hàng đợi và hoạt động tuần tra">
    <header className="pt-queue-heading">
      <div className="pt-queue-title"><span className="pt-queue-symbol"><Icon name="route"/></span><div><span className="pt-eyebrow">THEO DÕI THỰC HIỆN</span><h3>Hàng đợi & hoạt động</h3><p>Trạng thái nhiệm vụ được cập nhật từ robot và hệ thống điều phối.</p></div></div>
      <div className="pt-queue-refresh"><span className={error ? 'has-error' : ''}>{error ? 'Chưa đồng bộ được' : updatedAt ? `Cập nhật ${dateTime(updatedAt)}` : 'Đang tải trạng thái'}</span><Button icon="refresh" onClick={onRefresh} disabled={loading}>Cập nhật hàng đợi</Button></div>
    </header>
    <div className="pt-queue-toolbar">
      <div className="pt-queue-tabs" role="tablist" aria-label="Trạng thái lượt tuần tra" onKeyDown={switchTab}>{TABS.map(item => <button type="button" role="tab" key={item.id} data-queue-tab={item.id} id={`${groupId}-${item.id}`} aria-controls={`${groupId}-panel`} aria-selected={tabId === item.id} tabIndex={tabId === item.id ? 0 : -1} onClick={() => setTabId(item.id)}>{item.label}<span>{scoped.filter(job => matchesTab(item, job)).length}</span></button>)}</div>
      <label className="pt-queue-filter"><Icon name="robot"/><select aria-label="Lọc robot trong hàng đợi" value={robotId} onChange={event => setRobotId(event.target.value)}><option value="">Tất cả robot</option>{robotOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    <div className="pt-queue-layout">
      <div className="pt-queue-list-panel" role="tabpanel" id={`${groupId}-panel`} aria-labelledby={`${groupId}-${tab.id}`}>
        <p className="pt-queue-description">{tab.description}</p>
        {listError && <div className="pt-queue-error" role="alert"><Icon name="info"/><div><strong>Chưa cập nhật được {tabId === 'ended' ? 'lịch sử tuần tra' : 'hàng đợi'}.</strong><p>{listError}</p>{visible.length > 0 && <p>Đang giữ dữ liệu lần tải trước.</p>}<Button icon="refresh" onClick={onRefresh}>Thử lại</Button></div></div>}
        <div className="pt-job-list" aria-label="Danh sách lượt tuần tra" aria-busy={listLoading}>
          {listLoading && !visible.length ? <div className="pt-queue-loading" role="status"><Icon name="refresh"/><span>Đang tải {tabId === 'ended' ? 'lịch sử tuần tra' : 'hàng đợi'}…</span></div> : visible.length ? visible.map(job => {
            const status = jobStatus(job);
            const workflow = workflows.find(item => item.workflowId === job.workflowId);
            const robot = robots.find(item => item.robotId === job.robotId);
            const label = status.label;
            return <button type="button" key={job.jobId} data-patrol-job-id={job.jobId} aria-pressed={job.jobId === selectedId} className={job.jobId === selectedId ? 'is-selected' : ''} onClick={() => onSelect?.(job.jobId)}>
              <span className="pt-queue-job-top"><span className={`pt-badge pt-badge-${status.tone}`}>{label}</span><span className="pt-queue-job-code">{job.jobCode || shortId(job.jobId)}</span></span>
              <strong>{workflow?.workflowName || 'Tuần tra'}</strong>
              <span className="pt-queue-job-robot"><Icon name="robot"/>{robotName(robot) || (job.robotId ? `Robot ${shortId(job.robotId)}` : 'Chưa giao robot')}</span>
              <span className="pt-queue-job-time"><Icon name="clock"/>{job.endedAt ? 'Kết thúc' : job.startedAt ? 'Bắt đầu' : 'Vào hàng đợi'} <time dateTime={job.endedAt || job.startedAt || job.queuedAt || undefined}>{dateTime(job.endedAt || job.startedAt || job.queuedAt)}</time></span>
            </button>;
          }) : <Empty title={robotId ? 'Robot này chưa có lượt phù hợp' : tab.empty} icon={tabId === 'ended' ? 'check' : 'robot'}>{robotId ? 'Chọn robot khác hoặc đổi trạng thái để xem các lượt còn lại.' : tabId === 'open' ? 'Chọn tuyến và robot ở phía trên để bắt đầu một lượt tuần tra.' : 'Các lượt phù hợp sẽ xuất hiện khi trạng thái được cập nhật.'}</Empty>}
        </div>
      </div>
      <div className="pt-job-detail">
        {detailError && <div className="pt-queue-error" role="alert"><Icon name="info"/><div><strong>Chưa cập nhật được chi tiết lượt.</strong><p>{detailError}</p><Button icon="refresh" onClick={onRefresh}>Tải lại chi tiết</Button></div></div>}
        {selected ? <PatrolJobMonitor detail={selected} catalog={catalog} writable={writable && !detailError} onAction={onAction}/> : selectedId && !detailError ? <div className="pt-queue-loading" role="status"><Icon name="refresh"/><span>Đang tải chi tiết lượt tuần tra…</span></div> : <Empty title="Chọn một lượt tuần tra" icon="shield">Xem robot phụ trách, vòng tuần tra, checkpoint và các yêu cầu tạm dừng tại đây.</Empty>}
      </div>
    </div>
  </section>;
}

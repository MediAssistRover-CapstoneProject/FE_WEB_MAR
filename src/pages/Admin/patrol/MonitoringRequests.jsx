import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { operationsApi } from '../../../features/operations/operationsApi.js';
import { allPatrolPages, patrolApi } from '../../../features/patrol/patrolApi.js';
import { jobStatus } from '../../../features/patrol/patrolModel.js';
import { Button } from './PatrolUi.jsx';

const types = { CROWD_MONITORING: 'Giám sát đám đông', RESTRICTED_AREA_MONITORING: 'Giám sát khu vực hạn chế' };
const statuses = { DRAFT: 'Bản nháp', SUBMITTED: 'Đã gửi', QUEUED: 'Đã vào hàng đợi', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', FAILED: 'Thất bại', RECOVERY_REQUIRED: 'Cần kiểm tra' };

export default function MonitoringRequests({ writable, revision }) {
  const [open, setOpen] = useState(false);
  return <details className="pt-card pt-monitoring-requests" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Yêu cầu giám sát</summary>
    {open && <RequestList writable={writable} revision={revision}/>}
  </details>;
}

function RequestList({ writable, revision }) {
  const [type, setType] = useState('CROWD_MONITORING'), [page, setPage] = useState(0), [id, setId] = useState('');
  const [data, setData] = useState(null), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    operationsApi.listRequests({ requestType: type, page, size: 10 }, { signal: controller.signal }).then(result => {
      if (!Array.isArray(result?.content)) throw new Error('Danh sách yêu cầu chưa đúng định dạng.');
      if (!controller.signal.aborted) setData(result);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [type, page, revision, refresh]);
  const requests = data?.content.filter(item => item.requestType === type) || [];
  const changePage = next => { setId(''); setData(null); setPage(next); };
  return <div className="pt-form-body">
    <div className="pt-form-grid">
      <label className="pt-field">Loại yêu cầu giám sát
        <select value={type} onChange={event => { changePage(0); setType(event.target.value); }}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      <label className="pt-field">Yêu cầu đã tạo
        <select value={id} onChange={event => setId(event.target.value)} disabled={!requests.length}>
          <option value="">{error ? 'Chưa tải được yêu cầu' : !data ? 'Đang đọc danh sách…' : requests.length ? 'Chọn yêu cầu' : 'Chưa có yêu cầu'}</option>
          {requests.map(item => <option key={item.serviceRequestId} value={item.serviceRequestId}>{item.requestCode} · {statuses[item.status] || item.status}</option>)}
        </select>
      </label>
    </div>
    {error && <p role="alert" className="pt-alert">{error}</p>}
    <div className="pt-actions">
      {(page > 0 || data?.totalPages > 1) && <><Button disabled={!page} onClick={() => changePage(page - 1)}>Trang trước</Button><span>Trang {page + 1}</span><Button disabled={!data || page + 1 >= data.totalPages} onClick={() => changePage(page + 1)}>Trang sau</Button></>}
      <Button icon="refresh" onClick={() => setRefresh(value => value + 1)}>Cập nhật yêu cầu</Button>
    </div>
    {id && <RequestDetail key={id} id={id} type={type} writable={writable} revision={revision + refresh} onChange={() => setRefresh(value => value + 1)}/>}
  </div>;
}

function RequestDetail({ id, type, writable, revision, onChange }) {
  const [data, setData] = useState(null), [loadError, setLoadError] = useState(''), [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setData(null); setLoadError('');
    Promise.all([
      operationsApi.getRequest(id, options),
      allPatrolPages((params, config) => patrolApi.listJobs({ ...params, requestId: id, includeDeleted: true }, config), options),
    ]).then(([request, jobs]) => {
      if (request?.serviceRequestId !== id || request.requestType !== type) throw new Error('Yêu cầu đã chọn không thuộc loại giám sát này.');
      if (!controller.signal.aborted) {
        setData({ request, jobs: jobs.filter(job => job.serviceRequestId === id) });
        if (request.status !== 'DRAFT') setSubmitError('');
      }
    }).catch(cause => { if (!controller.signal.aborted) setLoadError(cause.message); });
    return () => controller.abort();
  }, [id, type, revision]);

  const submit = async () => {
    if (lock.current || !writable || data?.request.status !== 'DRAFT' || data.jobs.length) return;
    lock.current = true; setBusy(true); setSubmitError('');
    try {
      const current = await operationsApi.getRequest(id);
      if (current?.serviceRequestId !== id || current.requestType !== type) throw new Error('Yêu cầu đã thay đổi.');
      if (current.status === 'DRAFT') await operationsApi.submitRequest(id);
    } catch (cause) {
      setSubmitError(cause.message);
    } finally {
      // A lost submit response may already have queued the job. Re-read before enabling another submit.
      setData(null); lock.current = false; setBusy(false); onChange();
    }
  };

  const error = loadError || submitError;
  return <div className="pt-request-detail">
    {error && <p className="pt-alert" role="alert">{error}</p>}
    {data ? <>
      <p><strong>{data.request.requestCode}</strong> · {statuses[data.request.status] || data.request.status}</p>
      {data.request.requestNote && <p>{data.request.requestNote}</p>}
      {data.jobs.length > 0 ? <ul>{data.jobs.map(job => <li key={job.jobId}>
        <Link to={`/admin/live-operations?jobId=${encodeURIComponent(job.jobId)}`}>{job.jobCode || job.jobId}</Link> · {jobStatus(job).label}
      </li>)}</ul> : <p>Chưa có nhiệm vụ cho yêu cầu này.</p>}
      {writable && data.request.status === 'DRAFT' && !data.jobs.length && <Button tone="primary" disabled={busy} onClick={submit}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu vào hàng đợi'}</Button>}
    </> : !error && <p role="status">Đang kiểm tra yêu cầu và nhiệm vụ…</p>}
  </div>;
}

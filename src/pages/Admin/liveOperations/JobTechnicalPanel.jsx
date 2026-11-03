import { useId, useState } from 'react';
import { jobPresentation, jobProblem, statusInfo, durationLabel } from '../../../features/operations/liveOperations.js';
import { vi } from '../../../i18n/vi.js';
import './jobTechnicalPanel.css';

const present = value => value !== undefined && value !== null && value !== '';

// Preserve field names for log comparisons while masking credential values.
export function diagnosticJson(value) {
  return JSON.stringify(value, (key, item) => /password|secret|token|proof|api[_-]?key|authorization/i.test(key) ? '[REDACTED]' : item, 2);
}

function CopyButton({ value, name }) {
  const [message, setMessage] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(String(value)); setMessage('Đã sao chép'); }
    catch { setMessage('Không thể sao chép. Bạn có thể chọn và sao chép nội dung trực tiếp.'); }
  };
  return <span className="lo-tech-copy"><button type="button" className="lo-text-button" onClick={copy} aria-label={`Sao chép ${name}`}>Sao chép</button><span role="status">{message}</span></span>;
}

function Reference({ title, name, value }) {
  if (!present(value)) return null;
  return <div className="lo-tech-reference"><div><span>{title}</span>{name && <small>{name}</small>}</div><div><code>{String(value)}</code><CopyButton value={value} name={title} /></div></div>;
}

function Fields({ rows }) {
  return <dl className="lo-tech-fields">{rows.filter(([, value]) => present(value)).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>)}</dl>;
}

function Disclosure({ title, caption, children, className = '' }) {
  const [open, setOpen] = useState(false);
  return <details className={`lo-tech-card lo-tech-disclosure ${className}`} onToggle={event => setOpen(event.currentTarget.open)}><summary><span>{title}<small>{caption}</small></span><span className="lo-tech-chevron" aria-hidden="true">⌄</span></summary>{open && <div className="lo-tech-card-body">{children}</div>}</details>;
}

function JsonBlock({ title, value }) {
  if (!present(value) || typeof value === 'object' && !Object.keys(value).length) return null;
  const json = diagnosticJson(value);
  return <section className="lo-tech-json-block"><header><h5>{title}</h5><CopyButton value={json} name={title} /></header><pre tabIndex={0} aria-label={title}><code>{json}</code></pre></section>;
}

export default function JobTechnicalPanel({ detail, catalogs }) {
  const job = detail.job;
  const info = jobPresentation(job, catalogs), problem = jobProblem(detail);
  const steps = [...(detail.steps || [])].sort((a, b) => (a.executionSequenceNo || 0) - (b.executionSequenceNo || 0));
  const [scope, setScope] = useState('job');
  const scopeId = useId();
  const selected = scope === 'job' ? null : steps.find(step => step.jobStepId === scope);
  const data = selected || job;
  const issueSteps = steps.filter(step => step.errorCode || ['FAILED', 'RECOVERY_REQUIRED'].includes(step.status) && step.errorDetailsJson && Object.keys(step.errorDetailsJson).length);
  const hasIssue = !!(problem || job.errorCode || job.failureReason || issueSteps.length);
  const input = selected ? selected.resolvedInputsJson : job.inputJson;
  const result = data.resultJson;
  const hasData = [input, result, !selected && job.contextJson].some(value => value && (typeof value !== 'object' || Object.keys(value).length));
  const robot = catalogs.robots?.find(item => item.robotId === job.robotId);

  return <section className="lo-technical lo-tech-panel" aria-label="Tra cứu kỹ thuật">
    <p className="lo-tech-intro">Tra cứu mã liên kết và chẩn đoán lần thực thi. Các nhóm dữ liệu chuyên sâu được thu gọn bên dưới.</p>
    <section className="lo-tech-card"><header><h4>Mã tra cứu</h4><p>Dùng khi đối chiếu nhật ký máy chủ và robot.</p></header><div className="lo-tech-references">
      <Reference title="Mã công việc" value={job.jobCode} />
      <Reference title="ID công việc" value={job.jobId} />
      <Reference title="Robot" name={robot?.robotName || robot?.robotCode} value={job.robotId} />
      <Reference title="Quy trình" name={info.workflow} value={job.workflowId} />
      <Reference title="Yêu cầu liên quan" name={info.requestCode} value={job.serviceRequestId} />
      <Reference title="Bản đồ" value={job.mapId} />
    </div></section>
    {hasIssue && <section className="lo-tech-card lo-tech-diagnostics"><header><h4>Chẩn đoán lỗi</h4><p>{problem?.message || 'Thông tin lỗi đã được ghi nhận trong quá trình thực thi.'}</p></header><div className="lo-tech-card-body">
      {job.errorCode && <Fields rows={[["Mã lỗi công việc", job.errorCode], ["Thông báo máy chủ", job.failureReason]]} />}
      {!job.errorCode && job.failureReason && <p className="lo-tech-error-message">{job.failureReason}</p>}
      {issueSteps.map(step => <div className="lo-tech-step-issue" key={step.jobStepId || step.executionSequenceNo}><header><strong>Bước {steps.indexOf(step) + 1} · {vi(step.stepTypeSnapshot)}</strong><span>{statusInfo(step.status).label}</span></header><Fields rows={[["Mã bước", step.stepCodeSnapshot], ["Mã lỗi", step.errorCode], ["Lần thử", step.attemptNo]]} /><Reference title={`ID bước ${steps.indexOf(step) + 1}`} value={step.jobStepId} />{step.errorDetailsJson && Object.keys(step.errorDetailsJson).length > 0 && <Disclosure title="Chi tiết chẩn đoán bước" caption="Thông tin phản hồi đã ghi nhận"><JsonBlock title="errorDetailsJson" value={step.errorDetailsJson} /></Disclosure>}</div>)}
    </div></section>}
    <Disclosure title="Thông số thực thi" caption="Ưu tiên, phiên bản và các thông số của lần chạy">
      <Fields rows={[
        ['Độ ưu tiên', job.priority],
        ['Bộ điều phối', typeof job.beOrchestrated === 'boolean' ? job.beOrchestrated ? 'Máy chủ điều phối từng bước' : 'Robot thực thi quy trình' : null],
        ['Phiên bản giao tiếp', job.protocolVersion], ['Phiên bản schema', job.schemaVersion], ['Phiên bản đồ thị', job.graphVersion],
        ['Phiên bản bản ghi', job.rowVersion], ['Số tác vụ đã ghi nhận', detail.tasks?.length], ['Số lượt bước đã ghi nhận', steps.length],
      ]} />
      <Reference title="Hash quy trình" value={job.workflowHash} />
      <Reference title="Lệnh điều phối" value={job.dispatchCommandId} />
      <Reference title="Lệnh hủy" value={job.cancelCommandId} />
    </Disclosure>
    <Disclosure title="Dữ liệu đầu vào và kết quả" caption="Chọn công việc hoặc một bước để xem dữ liệu JSON">
      <div className="lo-tech-scope"><label htmlFor={scopeId}>Phạm vi dữ liệu</label><select id={scopeId} value={selected ? scope : 'job'} onChange={event => setScope(event.target.value)}><option value="job">Toàn công việc</option>{steps.filter(step => step.jobStepId).map(step => <option key={step.jobStepId} value={step.jobStepId}>Bước {steps.indexOf(step) + 1} · {vi(step.stepTypeSnapshot)} · {step.stepCodeSnapshot} · Lần thử {step.attemptNo || 1}</option>)}</select></div>
      {selected && <div className="lo-tech-selected-step"><Fields rows={[["Mã bước", selected.stepCodeSnapshot], ["Trạng thái", statusInfo(selected.status).label], ["Lần thử", selected.attemptNo], ["Giới hạn chờ", selected.timeoutSecSnapshot > 0 ? durationLabel(selected.timeoutSecSnapshot) : null], ["Thứ tự thực thi", selected.executionSequenceNo]]} /><Reference title="ID bước" value={selected.jobStepId} /><Reference title="ID bước định nghĩa" value={selected.stepId} /><Reference title="Mã thao tác" value={selected.operationKey} /></div>}
      {!hasData && <p className="lo-tech-empty">Chưa có dữ liệu đầu vào hoặc kết quả được ghi nhận cho mục này.</p>}
      <JsonBlock title={selected ? 'Đầu vào thực tế · resolvedInputsJson' : 'Đầu vào · inputJson'} value={input} />
      <JsonBlock title="Kết quả · resultJson" value={result} />
      {!selected && <JsonBlock title="Ngữ cảnh thực thi · contextJson" value={job.contextJson} />}
    </Disclosure>
  </section>;
}

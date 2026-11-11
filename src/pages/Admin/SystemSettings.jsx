import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSession } from '../../features/auth/session.js';
import { systemSettingsApi as api } from '../../features/admin/systemSettingsApi.js';
import { datasetLabels, mqttChange, mqttModes, retentionModes, retentionSpec, settingPayload, settingSpecs } from '../../features/admin/systemSettings.js';
import { vi } from '../../i18n/vi.js';
import './systemSettings.css';

const tabs = [
  { id: 'settings', title: 'Vận hành chung', icon: 'sliders' },
  { id: 'mqtt', title: 'Chẩn đoán MQTT', icon: 'connection' },
  { id: 'retention', title: 'Lưu trữ dữ liệu', icon: 'storage' },
];
const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có thông tin';
const count = value => Number.isFinite(value) ? value.toLocaleString('vi-VN') : '—';

function Icon({ name }) {
  const paths = {
    sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v6M16 9v6M10 15v6" /></>,
    connection: <><path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0" /><circle cx="12" cy="20" r="1" /></>,
    storage: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 13 3M18 18A8 8 0 0 1 5 15" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.sliders}</svg>;
}

function useResource(loader, revision = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ ...previous, loading: true, error: '' }));
    loader(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: '' });
    }).catch(error => { if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: error.message })); });
    return () => controller.abort();
  }, [loader, revision, retry]);
  return { ...state, reload: () => setRetry(value => value + 1) };
}

function Feedback({ error, message }) {
  return error ? <p className="sys-message is-error" role="alert">{error}</p> : message ? <p className="sys-message is-success" role="status">{message}</p> : null;
}
function Badge({ good, children }) { return <span className={`sys-badge${good === true ? ' is-good' : good === false ? ' is-warning' : ''}`}>{children}</span>; }
function PanelHeader({ title, description, reload, loading }) {
  return <header className="sys-panel-heading"><div><h2>{title}</h2><p>{description}</p></div>{reload && <button className="sys-button sys-refresh" type="button" onClick={reload} disabled={loading}><Icon name="refresh" />Tải lại</button>}</header>;
}
function ResourceMessage({ resource }) {
  return <>{resource.loading && <p className="sys-loading" role="status">Đang tải cấu hình…</p>}<Feedback error={resource.error} /></>;
}

export default function SystemSettings() {
  const session = getSession();
  if (session?.account?.role !== 'ADMIN' || session?.mode === 'demo') return <section className="sys-page"><p className="sys-message is-error" role="alert">Đăng nhập tài khoản quản trị viên để xem và thay đổi cài đặt hệ thống.</p></section>;
  return <SettingsWorkspace />;
}

function SettingsWorkspace() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.find(item => item.id === params.get('tab')) || tabs[0];
  return <section className="sys-page" aria-label="Cài đặt hệ thống">
    <header className="sys-heading"><div><span className="sys-eyebrow">QUẢN TRỊ HỆ THỐNG</span><h1>Cấu hình & kết nối</h1><p>Điều chỉnh vận hành, kiểm tra kết nối và quản lý dữ liệu tại một nơi.</p></div><span className="sys-admin-tag">Chỉ quản trị viên</span></header>
    <nav className="sys-tabs" aria-label="Danh mục chức năng">{tabs.map(item => <button type="button" key={item.id} className={tab.id === item.id ? 'is-active' : ''} aria-current={tab.id === item.id ? 'page' : undefined} onClick={() => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab', item.id); return next; }, { replace: true })}><Icon name={item.icon} /><span>{item.title}</span></button>)}</nav>
    <div className="sys-content" key={tab.id}>{tab.id === 'settings' ? <GeneralSettings /> : tab.id === 'mqtt' ? <MqttSettings /> : <RetentionSettings />}</div>
  </section>;
}

function SettingForm({ rows, settingKey, spec = settingSpecs[settingKey], rooms, disabled, onSaved, onBusy, effective }) {
  const row = rows.find(item => item.settingKey === settingKey);
  const current = row?.settingValue?.value;
  const initial = current ?? effective ?? '';
  const [draft, setDraft] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const lock = useRef(false), identity = JSON.stringify([row?.systemSettingId, current, effective]);
  useEffect(() => { setDraft(initial); setError(''); }, [identity]);
  const save = async event => {
    event.preventDefault(); if (lock.current || disabled) return;
    setError(''); setMessage('');
    try {
      const body = settingPayload(row, settingKey, spec, draft);
      if (spec.room && !rooms?.some(room => room.roomId === body.settingValue.value && room.active)) throw Error('Chọn phòng đang hoạt động để tiếp nhận SOS.');
      lock.current = true; setBusy(true); onBusy?.(true);
      const result = await api.saveSetting(row, body);
      onSaved(result); setMessage('Đã lưu cấu hình.');
    } catch (error) { setError(error.message); }
    finally { lock.current = false; setBusy(false); onBusy?.(false); }
  };
  const changed = row ? String(draft) !== String(current) : spec.type === 'BOOLEAN' ? typeof draft === 'boolean' : String(draft).trim() !== '';
  const controlId = `sys-${settingKey}`;
  return <form className="sys-setting" onSubmit={save} aria-label={spec.title}>
    <div className="sys-setting-copy"><label htmlFor={controlId}>{spec.title}</label>{spec.hint && <p>{spec.hint}</p>}{!row && effective === undefined && <small>Chưa có cấu hình riêng trên máy chủ.</small>}</div>
    <div className="sys-setting-edit"><div className="sys-control">{spec.room ? <select id={controlId} value={draft} disabled={disabled || busy || !rooms} onChange={event => { setDraft(event.target.value); setMessage(''); }} required><option value="">Chọn phòng tiếp nhận</option>{current && !rooms?.some(room => room.roomId === current) && <option value={current} disabled>Phòng đã cấu hình không còn khả dụng</option>}{rooms?.map(room => <option key={room.roomId} value={room.roomId} disabled={!room.active}>{room.roomName || room.roomCode}{!room.active ? ' · Ngừng hoạt động' : ''}</option>)}</select>
      : spec.options ? <select id={controlId} value={draft} disabled={disabled || busy} onChange={event => { setDraft(event.target.value); setMessage(''); }} required><option value="" disabled>Chọn cách xử lý</option>{Object.entries(spec.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      : spec.type === 'BOOLEAN' ? !row ? <select id={controlId} value={draft === '' ? '' : String(draft)} disabled={disabled || busy} onChange={event => setDraft(event.target.value === 'true')} required><option value="" disabled>Chọn trạng thái</option><option value="true">Bật</option><option value="false">Tắt</option></select> : <label className="sys-switch"><input id={controlId} type="checkbox" checked={draft === true} disabled={disabled || busy} onChange={event => { setDraft(event.target.checked); setMessage(''); }} /><span aria-hidden="true" /><b>{draft ? 'Bật' : 'Tắt'}</b></label>
      : <><input id={controlId} type="number" min={spec.min} max={spec.max} step="1" required value={draft} disabled={disabled || busy} placeholder={`${spec.min}–${spec.max}`} onChange={event => { setDraft(event.target.value); setMessage(''); }} />{spec.unit && <span className="sys-unit">{spec.unit}</span>}</>}</div><button type="submit" className="sys-button sys-primary" disabled={disabled || busy || !changed}>{busy ? 'Đang lưu…' : 'Lưu'}</button></div>
    <Feedback error={error} message={message} />
  </form>;
}

function GeneralSettings() {
  const settings = useResource(api.listSettings), rooms = useResource(api.listRooms);
  const rows = settings.data || [], [updates, setUpdates] = useState({});
  const values = rows.map(row => updates[row.settingKey] || row).concat(Object.values(updates).filter(row => !rows.some(value => value.settingKey === row.settingKey)));
  const onSaved = result => setUpdates(previous => ({ ...previous, [result.settingKey]: result }));
  const reload = () => { setUpdates({}); settings.reload(); rooms.reload(); };
  const other = values.filter(row => !settingSpecs[row.settingKey] && !row.settingKey.startsWith('retention.') && row.settingKey !== 'robot.speech.profile');
  return <>
    <PanelHeader title="Vận hành chung" description="Các thiết lập ảnh hưởng trực tiếp đến robot và người tiếp nhận hỗ trợ." reload={reload} loading={settings.loading} />
    <ResourceMessage resource={settings} />
    {settings.data && <div className="sys-main-grid"><div className="sys-stack"><section className="sys-card"><div className="sys-card-heading"><span className="sys-card-icon"><Icon name="connection" /></span><div><h3>Kết nối robot</h3><p>Nhận biết robot mất tín hiệu kịp thời.</p></div></div><SettingForm rows={values} settingKey="operations.robot_offline_threshold_seconds" onSaved={onSaved} disabled={settings.loading || !!settings.error} /></section>
      <section className="sys-card"><div className="sys-card-heading"><span className="sys-card-icon is-purple"><Icon name="sliders" /></span><div><h3>Tiếp nhận khẩn cấp</h3><p>Chọn nơi chịu trách nhiệm tiếp nhận SOS.</p></div></div><SettingForm rows={values} settingKey="sos.monitoring-room-id" rooms={rooms.data} onSaved={onSaved} disabled={settings.loading || !!settings.error || rooms.loading || !!rooms.error} /><Feedback error={rooms.error} /><p className="sys-footnote">Cần có nhân viên đang trực tại phòng đã chọn. <Link to="/admin/staff-shifts">Xem lịch trực ↗</Link></p></section>
      {other.length > 0 && <details className="sys-card sys-details"><summary>Cấu hình khác <span>{other.length} mục</span></summary><p className="sys-muted">Thông tin dành cho quản trị kỹ thuật.</p>{other.map(row => <div className="sys-technical-row" key={row.systemSettingId}><strong>{vi(row.settingKey)}</strong><code>{row.settingKey}</code><pre>{JSON.stringify(row.settingValue?.value, null, 2)}</pre></div>)}</details>}
    </div><aside className="sys-help"><span className="sys-eyebrow">THIẾT LẬP LIÊN QUAN</span><h3>Chuẩn bị robot trước khi giao việc</h3><p>Bản đồ đang hoạt động, phiên navigation và vị trí robot được quản lý tại trang thiết lập vận hành.</p><Link className="sys-link" to="/admin/robot-setup">Thiết lập vận hành <span>↗</span></Link><div className="sys-help-divider" /><h3>Giọng nói & thông báo</h3><p>Chọn giọng đọc, tốc độ và nội dung thông báo tại mục Giọng nói.</p><Link className="sys-link" to="/admin/voice-scripts">Mở cấu hình giọng nói <span>↗</span></Link></aside></div>}
  </>;
}

function MqttSettings() {
  const status = useResource(api.mqttStatus), robots = useResource(api.listRobots);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [mode, setMode] = useState(''), [halted, setHalted] = useState(false), [note, setNote] = useState('');
  const lock = useRef(false), data = status.data, rollout = data?.rollout;
  useEffect(() => { if (rollout) { setMode(rollout.mode); setHalted(rollout.dispatchHalted); setNote(''); } }, [rollout?.revision]);
  const submit = async event => {
    event.preventDefault(); if (lock.current || status.loading || status.error) return;
    setError(''); setMessage('');
    try {
      const body = mqttChange(data, mode, halted, note); lock.current = true; setBusy(true);
      await api.changeMqtt(body); setMessage('Đã cập nhật điều phối MQTT.'); status.reload();
    } catch (error) { setError(error.status === 409 ? 'Cấu hình đã được thay đổi ở nơi khác. Tải lại và kiểm tra trước khi lưu.' : error.message); if (error.status === 409) status.reload(); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    <PanelHeader title="Chẩn đoán MQTT" description="Kiểm tra đường truyền lệnh giữa máy chủ và robot." reload={() => { status.reload(); robots.reload(); }} loading={status.loading || busy} />
    <ResourceMessage resource={status} /><Feedback error={error} message={message} />
    {rollout && <><div className="sys-status-grid"><StatusCard title="Máy chủ MQTT" value={data.brokerConnected ? 'Đã kết nối' : 'Chưa kết nối'} good={data.brokerConnected} detail={data.mqttEnabled ? 'Dịch vụ MQTT đang bật' : 'Dịch vụ MQTT chưa bật'} /><StatusCard title="Phát lệnh cho robot" value={rollout.dispatchHalted ? 'Đang tạm ngừng' : data.dispatchEffective ? 'Sẵn sàng' : 'Chưa sẵn sàng'} good={data.dispatchEffective} detail={rollout.dispatchHalted ? 'Quản trị viên đã tạm ngừng phát lệnh' : data.dispatchConfigured ? 'Đã bật điều phối trên máy chủ' : 'Điều phối chưa được cấu hình'} /><StatusCard title="Robot sẵn sàng" value={`${(data.robots || []).filter(robot => robot.dispatchReady).length} / ${(data.robots || []).length}`} detail="Robot đã đăng ký MQTT" /></div>
      <section className="sys-card"><div className="sys-section-title"><div><h3>Trạng thái robot</h3><p>Tín hiệu và khả năng tiếp nhận lệnh mới.</p></div><span className="sys-updated">{timestamp(data.observedAt)}</span></div><div className="sys-table-scroll"><table className="sys-table"><thead><tr><th>Robot</th><th>Kết nối</th><th>Heartbeat gần nhất</th><th>Nhận lệnh</th></tr></thead><tbody>{(data.robots || []).map((robot, index) => <tr key={robot.robotId}><td><strong>{robots.data?.find(item => item.robotId === robot.robotId)?.robotName || robots.data?.find(item => item.robotId === robot.robotId)?.robotCode || `Robot ${index + 1}`}</strong>{robot.failureReason && <small>{vi(robot.failureReason)}</small>}</td><td><Badge good={robot.handshakeAccepted && robot.handshakeAcked}>{robot.handshakeAccepted && robot.handshakeAcked ? 'Đã xác nhận' : 'Chờ kết nối'}</Badge></td><td>{robot.heartbeatAgeSeconds == null ? 'Chưa có tín hiệu' : `${Math.round(robot.heartbeatAgeSeconds)} giây trước`}</td><td><Badge good={robot.dispatchReady}>{robot.dispatchReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</Badge></td></tr>)}</tbody></table>{!data.robots?.length && <p className="sys-empty">Chưa có robot được đăng ký MQTT.</p>}</div></section>
      <details className="sys-card sys-details"><summary>Hàng đợi & chẩn đoán nâng cao</summary><div className="sys-diagnostics">{[['Lệnh chưa gửi', data.unpublished?.count], ['Sự kiện đang chờ', data.inbox?.count], ['Xác nhận chưa gửi', data.eventAcks?.count], ['Công việc cần phục hồi', data.recoveryJobs]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{count(value)}</strong></div>)}</div>{data.workflows?.filter(workflow => !workflow.configurationReady).map(workflow => <p className="sys-footnote" key={workflow.workflowId}>{workflow.workflowCode}: {vi(workflow.blocker || 'Chưa sẵn sàng')}</p>)}</details>
      <details className="sys-card sys-details"><summary>Điều khiển điều phối <span>Nâng cao</span></summary><p className="sys-muted">Tạm ngừng phát lệnh mới không dừng khẩn cấp robot đang di chuyển.</p><form className="sys-mqtt-form" onSubmit={submit}><fieldset disabled={busy || status.loading || !!status.error}><label className="sys-checkbox"><input type="checkbox" checked={halted} onChange={event => setHalted(event.target.checked)} />Tạm ngừng phát lệnh mới</label><details className="sys-nested-details"><summary>Chuyển chế độ tương thích</summary><p className="sys-footnote">Chỉ chuyển tiếp từng bước. Không thể quay lại chế độ cũ sau khi lưu.</p><label className="sys-field">Chế độ vận hành<select value={mode} onChange={event => setMode(event.target.value)}>{Object.entries(mqttModes).map(([value, label], index) => <option key={value} value={value} disabled={index < Object.keys(mqttModes).indexOf(rollout.mode) || index > Object.keys(mqttModes).indexOf(rollout.mode) + 1}>{label}</option>)}</select></label>{data.legacyJobsBlockingCutover > 0 && <p className="sys-footnote">Còn {data.legacyJobsBlockingCutover} công việc cũ cần hoàn tất hoặc đối soát.</p>}</details><label className="sys-field">Lý do thay đổi<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} required placeholder="Ghi rõ lý do để lưu vào nhật ký" /></label><button className="sys-button sys-primary" disabled={!note.trim() || mode === rollout.mode && halted === rollout.dispatchHalted} type="submit">{busy ? 'Đang lưu…' : 'Lưu điều phối'}</button></fieldset></form></details>
    </>}
    {data && !rollout && <Feedback error="Máy chủ chưa trả về cấu hình MQTT hợp lệ." />}
  </>;
}

function StatusCard({ title, value, detail, good }) {
  return <div className="sys-status-card"><span>{title}</span><strong className={good === false ? 'is-warning' : good === true ? 'is-good' : ''}>{value}</strong><small>{detail}</small></div>;
}

function RetentionSettings() {
  const settings = useResource(api.listSettings), [revision, setRevision] = useState(0), [saving, setSaving] = useState(false), policies = useResource(api.retentionPolicies, revision);
  const [selected, setSelected] = useState(''), [result, setResult] = useState(null), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), rows = settings.data || [], data = Array.isArray(policies.data) ? policies.data : [];
  const policy = data.find(value => value.dataset === selected);
  const invalidate = () => { setResult(null); setConfirmed(false); settings.reload(); setRevision(value => value + 1); };
  const run = async dryRun => {
    if (lock.current || saving || settings.loading || settings.error || policies.loading || policies.error || !dryRun && (!confirmed || !result?.dryRun || result.executionEnabled !== true)) return;
    lock.current = true; setBusy(true); setError(''); setConfirmed(false); setResult(null);
    try { const value = await api.runRetention(dryRun); setResult(value); }
    catch (error) { setError(error.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    <PanelHeader title="Lưu trữ dữ liệu" description="Quản lý thời hạn giữ lịch sử và xử lý dữ liệu đã hết hạn." reload={invalidate} loading={policies.loading || settings.loading || busy || saving} />
    <ResourceMessage resource={policies} /><Feedback error={error || settings.error} />
    {policies.data && !Array.isArray(policies.data) && <Feedback error="Chính sách lưu trữ từ máy chủ không đúng định dạng." />}
    <div className="sys-info-banner"><Icon name="storage" /><div><strong>Chính sách đang có hiệu lực</strong><p>Thay đổi thời hạn chưa xóa dữ liệu. Xem trước kết quả trước khi thực hiện xử lý.</p></div><Badge>{data.length} nhóm dữ liệu</Badge></div>
    <section className="sys-card"><div className="sys-table-scroll"><table className="sys-table"><thead><tr><th>Nhóm dữ liệu</th><th>Thời hạn lưu</th><th>Cách xử lý</th><th><span className="sys-sr-only">Thao tác</span></th></tr></thead><tbody>{data.map(item => <tr key={item.dataset}><td><strong>{datasetLabels[item.dataset] || vi(item.dataset)}</strong></td><td>{count(item.retentionDays)} ngày</td><td><Badge good={item.mode === 'DISABLED' ? undefined : false}>{retentionModes[item.mode] || item.mode}</Badge></td><td>{datasetLabels[item.dataset] && <button type="button" className="sys-text-button" disabled={busy || saving || settings.loading || !!settings.error || policies.loading || !!policies.error} onClick={() => { setSelected(selected === item.dataset ? '' : item.dataset); setResult(null); setConfirmed(false); }} aria-expanded={selected === item.dataset}>{selected === item.dataset ? 'Thu gọn' : 'Điều chỉnh'}</button>}</td></tr>)}</tbody></table>{!policies.loading && !data.length && <p className="sys-empty">Chưa có chính sách lưu trữ.</p>}</div>
      {policy && <section className="sys-policy-edit" key={selected}><h3>Điều chỉnh · {datasetLabels[policy.dataset]}</h3>{policy.dataset === 'alert' || policy.dataset === 'alert_recipient' ? <p className="sys-footnote">Cảnh báo và người nhận cảnh báo dùng chung thời hạn và cách xử lý.</p> : null}{['days', 'mode'].map(field => { const spec = retentionSpec(policy.dataset, field); return <SettingForm key={spec.key} rows={rows} settingKey={spec.key} spec={spec} effective={field === 'days' ? policy.retentionDays : policy.mode} onSaved={invalidate} onBusy={setSaving} disabled={busy || saving || settings.loading || !!settings.error || policies.loading || !!policies.error} />; })}</section>}
    </section>
    {settings.data && <details className="sys-card sys-details"><summary>Cấu hình xử lý <span>Nâng cao</span></summary>{Object.keys(settingSpecs).filter(key => key.startsWith('retention.')).map(key => <SettingForm key={key} rows={rows} settingKey={key} onSaved={invalidate} onBusy={setSaving} disabled={busy || saving || settings.loading || !!settings.error} />)}</details>}
    <section className="sys-card sys-retention-run"><div className="sys-section-title"><div><h3>Kiểm tra dữ liệu hết hạn</h3><p>Xem số bản ghi đủ điều kiện xử lý theo chính sách hiện tại.</p></div><button className="sys-button" type="button" disabled={busy || saving || policies.loading || !!policies.error || settings.loading || !!settings.error || !Array.isArray(policies.data)} onClick={() => run(true)}>{busy ? 'Đang xử lý…' : 'Chạy xem trước'}</button></div>
      {result && <><div className="sys-run-summary"><Badge good={result.dryRun}>{result.dryRun ? 'Kết quả xem trước' : 'Kết quả xử lý'}</Badge><span>{timestamp(result.completedAt)}</span></div><div className="sys-table-scroll"><table className="sys-table"><thead><tr><th>Nhóm dữ liệu</th><th>Đã hết hạn</th><th>{result.dryRun ? 'Cách xử lý' : 'Đã xử lý'}</th></tr></thead><tbody>{result.datasets?.map(item => <tr key={item.dataset}><td>{datasetLabels[item.dataset] || vi(item.dataset)}{item.error && <small className="is-warning">{item.error}</small>}{item.truncated && <small>Còn dữ liệu cần xử lý ở lần sau.</small>}</td><td>{count(item.eligible)}</td><td>{result.dryRun ? retentionModes[item.mode] || item.mode : `${count(item.archived)} lưu trữ · ${count(item.deleted)} xóa`}</td></tr>)}</tbody></table></div>{result.dryRun && <div className="sys-execution">{result.executionEnabled ? <><p>Thực hiện thật sẽ lưu trữ hoặc xóa dữ liệu hết hạn theo các chế độ đang bật.</p><label className="sys-checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />Tôi đã kiểm tra kết quả và xác nhận xử lý dữ liệu hết hạn.</label><button className="sys-button sys-danger" type="button" disabled={!confirmed || busy || saving} onClick={() => run(false)}>Thực hiện xử lý</button></> : <p>Máy chủ đang khóa xử lý thật. Có thể điều chỉnh tại “Cấu hình xử lý”.</p>}</div>}</>}
    </section>
  </>;
}

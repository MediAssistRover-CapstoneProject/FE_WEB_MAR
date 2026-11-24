import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { patrolApi } from '../../../features/patrol/patrolApi.js';
import { patrolCheckpointLabel, patrolTemplateCount, SENSING_OPTIONS } from '../../../features/patrol/patrolModel.js';
import PatrolMapPreview from './PatrolMapPreview.jsx';
import { Button, Empty, Icon } from './PatrolUi.jsx';
import BrandMark from '../../../components/BrandMark.jsx';

export const robotName = robot => robot?.robotName || robot?.robotCode || 'Chưa phân công';
export const roundLabel = route => route?.continuous ? 'Liên tục đến khi dừng' : `${route?.repeatCount ?? 1} vòng`;
const robotStatuses = { IDLE: 'Sẵn sàng', BUSY: 'Đang làm nhiệm vụ', OFFLINE: 'Mất kết nối', CHARGING: 'Đang sạc', ERROR: 'Cần kiểm tra', MAINTENANCE: 'Bảo trì' };

export function RouteLibrary({ catalog, loading, error, workflows, workflowId, selectRoute, mapFilter, changeMap, search, setSearch, writable, onCreate }) {
  return <section className="pt-card pt-library" aria-label="Chọn tuyến tuần tra">
    <div className="pt-library-toolbar">
      <div><span className="pt-eyebrow">KẾ HOẠCH TUẦN TRA</span><h3>Chọn bản đồ và tuyến <span className="pt-count">{workflows.length}</span></h3></div>
      <div className="pt-library-filters">
        <label className="pt-field"><span>Lọc theo bản đồ</span><select aria-label="Lọc tuyến theo bản đồ" value={mapFilter} onChange={event => changeMap(event.target.value)}><option value="">Tất cả bản đồ</option>{catalog.maps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName}{map.status !== 'ACTIVE' ? ' · Chưa kích hoạt' : ''}</option>)}</select></label>
        <label className="pt-search"><Icon name="search"/><input aria-label="Tìm tuyến tuần tra" placeholder="Tìm tên hoặc mã tuyến…" value={search} onChange={event => setSearch(event.target.value)}/></label>
      </div>
    </div>
    <div className="pt-template-library"><p>Chọn số điểm, rồi chọn bản đồ và điểm đến cho từng lượt chạy.</p><div className="pt-template-choices">{(catalog.templates || []).map(template => <Button key={template.checkpointCount} onClick={() => onCreate(template.checkpointCount)} disabled={!writable || loading || !!error}><Icon name="route"/>Tuần tra {template.checkpointCount} điểm</Button>)}</div></div>
    <div className="pt-route-list">
      {loading && !catalog.workflows.length ? <p className="pt-loading" role="status">Đang tải danh sách tuyến…</p> : workflows.length ? workflows.map(workflow => {
        const published = workflow.status === 'PUBLISHED' && workflow.acceptsNewJobs;
        const map = catalog.maps.find(item => item.mapId === workflow.defaultInputsJson?.map_id);
        const count = patrolTemplateCount(workflow);
        return <button type="button" className={`pt-route-card ${workflow.workflowId === workflowId ? 'is-selected' : ''}`} key={workflow.workflowId} aria-pressed={workflow.workflowId === workflowId} onClick={() => selectRoute(workflow.workflowId)}>
          <span className="pt-route-symbol"><Icon name="route"/></span>
          <span className="pt-route-card-copy"><strong>{workflow.workflowName}</strong><span>{count ? `${count} điểm · Chọn bản đồ khi chạy` : `${map?.mapName || 'Xem bản đồ trong chi tiết tuyến'} · Tuyến cố định`}</span></span>
          <span className={`pt-badge pt-badge-${published ? 'green' : 'neutral'}`}>{published ? 'Sẵn sàng' : workflow.status === 'ARCHIVED' ? 'Lưu trữ' : workflow.status === 'PUBLISHED' ? 'Ngừng nhận việc' : 'Bản nháp'}</span>
        </button>;
      }) : <Empty title={search || mapFilter ? 'Không có tuyến phù hợp' : 'Chưa có tuyến tuần tra'}>{search || mapFilter ? 'Thử đổi bản đồ hoặc từ khóa tìm kiếm.' : 'Tạo tuyến, chọn bản đồ và các điểm robot cần kiểm tra.'}</Empty>}
    </div>
    <div className="pt-library-footer"><span>Mẫu được dùng lại; mỗi nhiệm vụ giữ cấu hình điểm riêng.</span><Button icon="plus" onClick={() => onCreate(3)} disabled={!writable || loading || !!error}>Tạo lượt mới</Button></div>
  </section>;
}

export function RouteMapPanel({ workflowId, detail, route, map, catalog, error, loading, snapshot, robot, targetEndpointId, onRefresh }) {
  const nonPatrol = detail && detail.workflow?.serviceType !== 'PATROL';
  if (route.template) return <section className="pt-card pt-route-detail" aria-label="Mẫu tuần tra"><div className="pt-card-heading"><div><span className="pt-eyebrow">MẪU TUẦN TRA</span><h3>{route.workflow.workflowName}</h3></div><span className="pt-badge pt-badge-green">{route.checkpointCount} điểm</span></div><div className="pt-template-description"><p>Mỗi lượt chạy chọn bản đồ và đúng {route.checkpointCount} điểm đến hoặc nhóm điểm trong phòng.</p><ol className="pt-checkpoints">{route.checkpoints.map(point => <li key={point.index}><span className="pt-point-number">{point.index}</span><div><strong>Điểm {point.index} · Chọn khi chạy</strong><span>Phát hiện ngã · 3 giây</span></div></li>)}</ol><p className="pt-muted">Mẫu giữ nguyên định nghĩa quy trình. Bản đồ, điểm ghé, tốc độ và số vòng được lưu theo từng nhiệm vụ hoặc lịch.</p><Link to={`/workflow?workflowId=${encodeURIComponent(workflowId)}`}>Xem chi tiết quy trình →</Link></div></section>;
  return <section className="pt-card pt-route-detail" aria-label="Bản đồ và lộ trình tuần tra">
    <div className="pt-card-heading"><div><span className="pt-eyebrow">BẢN ĐỒ & LỘ TRÌNH</span><h3>{detail?.workflow?.workflowName || 'Hành trình tuần tra'}</h3></div><span className={`pt-badge pt-badge-${route.published ? 'green' : 'neutral'}`}>{route.published ? 'Đã phát hành' : 'Chưa sẵn sàng chạy'}</span></div>
    {error ? <div className="pt-alert" role="alert"><span>Không tải được tuyến từ liên kết. {error}</span><Button icon="refresh" onClick={onRefresh}>Tải lại tuyến</Button></div> : nonPatrol ? <Empty title="Quy trình này không phải tuyến tuần tra">Chọn một tuyến tuần tra ở trên để tiếp tục.</Empty> : loading && workflowId ? <p className="pt-loading" role="status">Đang đọc bản đồ và các điểm của tuyến…</p> : !detail ? <Empty icon="map" title="Chọn tuyến để xem bản đồ">Bản đồ, các điểm kiểm tra và vị trí robot sẽ hiển thị tại đây.</Empty> : <>
      <div className="pt-route-meta"><span><Icon name="map"/>{map?.mapName || 'Chưa tìm thấy bản đồ'}</span><span><Icon name="route"/>{route.checkpoints.length} điểm kiểm tra</span><span><Icon name="loop"/>{roundLabel(route)}</span></div>
      <PatrolMapPreview map={map} points={route.checkpoints.map(point => point.endpoint || { endpointId: point.endpointId })} zones={catalog.zones} snapshot={snapshot} robotName={robotName(robot)} targetEndpointId={targetEndpointId}/>
      <div className="pt-stop-heading"><h4>Thứ tự di chuyển</h4><span>Khởi hành từ vị trí thực tế của robot</span></div>
      {route.checkpoints.length ? <ol className="pt-checkpoints">{route.checkpoints.map((point, index) => <li key={point.stepId || index} className={targetEndpointId && targetEndpointId === point.endpointId ? 'is-current' : ''}><span className="pt-point-number">{index + 1}</span><div><strong>{point.endpoint?.endpointName || point.endpoint?.endpointCode || 'Điểm không còn khả dụng'}</strong><span>{SENSING_OPTIONS.find(option => option.value === point.sensingType)?.label || 'Di chuyển'}{point.windowSec ? ` · ${point.windowSec} giây` : ''}</span></div>{targetEndpointId === point.endpointId && <span className="pt-current-stop">Đang đến</span>}</li>)}</ol> : <p className="pt-muted">Tuyến chưa có điểm đến cố định.</p>}
      {!!route.issues.length && <div className="pt-notice" role="status">{route.issues.join(' ')}</div>}
      <div className="pt-map-footer"><span>Đường nối thể hiện thứ tự ghé điểm; robot tự lập đường đi trên bản đồ.</span><Link to={`/workflow?workflowId=${encodeURIComponent(workflowId)}`}>Chi tiết quy trình</Link></div>
    </>}
  </section>;
}

export function DispatchPanel({ catalog, route, map, robotId, onRobotChange, robot, snapshot, blocked, reasons, busy, pending, onReview, updatedAt, onConfigure, writable }) {
  const batteryValue = robot?.batteryPercent ?? snapshot?.latestTelemetry?.batteryPercent;
  const battery = batteryValue == null ? null : Number(batteryValue);
  if (route.template) return <aside className="pt-card pt-dispatch" aria-label="Cấu hình lượt tuần tra"><div className="pt-card-heading"><div><span className="pt-eyebrow">GIAO NHIỆM VỤ</span><h3>Cấu hình lượt tuần tra</h3></div><Icon name="robot"/></div><p className="pt-muted">Chọn robot, bản đồ và {route.checkpointCount} điểm ghé. Có thể chạy ngay hoặc lập lịch một lần, theo khoảng thời gian hay cron.</p><Button icon="play" tone="primary" className="pt-dispatch-button" disabled={!writable || !route.published || pending} onClick={onConfigure}>Cấu hình & giao robot</Button><p className="pt-dispatch-note">Khi lập lịch, robot chỉ cần sẵn sàng tại thời điểm chạy. Mỗi điểm quan sát ngã 3 giây; giám sát liên tục trên robot vẫn độc lập.</p></aside>;
  return <aside className="pt-card pt-dispatch" aria-label="Giao nhiệm vụ cho robot">
    <div className="pt-card-heading"><div><span className="pt-eyebrow">GIAO NHIỆM VỤ</span><h3>Robot thực hiện</h3></div><span className="pt-soft-icon"><Icon name="robot"/></span></div>
    <label className="pt-field"><span>Robot tuần tra</span><select aria-label="Robot tuần tra" value={robotId} onChange={event => onRobotChange(event.target.value)} disabled={busy || pending}><option value="">Chọn robot thực hiện</option>{catalog.robots.map(item => <option key={item.robotId} value={item.robotId}>{robotName(item)} · {robotStatuses[item.status] || item.status}</option>)}</select></label>
    {robot ? <div className="pt-robot-info"><span className="pt-robot-avatar"><BrandMark /></span><div><strong>{robotName(robot)}</strong><span>{robotStatuses[robot.status] || robot.status}{snapshot?.heartbeatFresh ? ' · Có kết nối' : ''}</span></div>{Number.isFinite(battery) && battery >= 0 && battery <= 100 && <span className="pt-battery">{Math.round(battery)}% pin</span>}</div> : <p className="pt-robot-placeholder">Chọn robot để kiểm tra kết nối, bản đồ và khả năng nhận việc.</p>}
    <dl className="pt-run-summary"><div><dt>Bản đồ</dt><dd>{map?.mapName || 'Chưa chọn'}</dd></div><div><dt>Điểm kiểm tra</dt><dd>{route.checkpoints.length} điểm mỗi vòng</dd></div><div><dt>Chế độ</dt><dd>{roundLabel(route)}</dd></div><div><dt>Ưu tiên</dt><dd>Nhường SOS và hỗ trợ</dd></div></dl>
    <div className={`pt-readiness ${!blocked ? 'is-ready' : ''}`} role="status"><Icon name={!blocked ? 'check' : 'info'}/><div><strong>{!blocked ? 'Sẵn sàng đưa vào hàng đợi' : 'Chưa thể bắt đầu'}</strong>{blocked ? <ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>Robot đã kết nối và đúng bản đồ. Máy chủ kiểm tra lại trước khi giao nhiệm vụ.</p>}</div></div>
    <Button icon="play" tone="primary" className="pt-dispatch-button" disabled={blocked || busy || pending} onClick={onReview}>Bắt đầu tuần tra</Button>
    <p className="pt-dispatch-note">Lượt gửi vào hàng đợi trước. Trạng thái chạy được cập nhật khi robot thực sự nhận nhiệm vụ.</p>
    {updatedAt && <p className="pt-connection-time">Kết nối cập nhật lúc {new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
    <div className="pt-priority-note"><Icon name="shield"/><div><strong>Nhường việc khẩn cấp, giữ tiến độ</strong><p>Robot có thể tạm dừng vì SOS, cuộc gọi hoặc yêu cầu hỗ trợ. Theo dõi lý do và tiếp tục tại hàng đợi bên dưới.</p></div></div>
  </aside>;
}

export function PatrolSchedules({ schedules = [], catalog, error, writable, onRefresh }) {
  const [busyId, setBusyId] = useState(''), [actionError, setActionError] = useState('');
  const locked = useRef(false);
  const visible = schedules.filter(schedule => ['ACTIVE', 'PAUSED'].includes(schedule.status));
  const changeState = async schedule => {
    if (locked.current) return;
    locked.current = true; setBusyId(schedule.scheduleId); setActionError('');
    try { await (schedule.status === 'ACTIVE' ? patrolApi.pauseSchedule : patrolApi.activateSchedule)(schedule.scheduleId); onRefresh(); }
    catch (cause) { setActionError(`${cause.message} Hãy cập nhật danh sách để xác nhận trạng thái lịch trước khi thao tác tiếp.`); onRefresh(); }
    finally { locked.current = false; setBusyId(''); }
  };
  return <section className="pt-card pt-schedules" aria-label="Lịch tuần tra"><div className="pt-card-heading"><div><span className="pt-eyebrow">LỊCH ĐÃ LƯU</span><h3>Lịch tuần tra <span className="pt-count">{visible.length}</span></h3></div><Button icon="refresh" onClick={onRefresh}>Cập nhật lịch</Button></div>
    {(error || actionError) && <p className="pt-alert" role="alert">{error || actionError}</p>}
    {visible.length ? <div className="pt-schedule-list">{visible.map(schedule => {
      const workflow = catalog.workflows.find(item => item.workflowId === schedule.workflowId);
      const inputs = schedule.inputTemplateJson || {};
      const map = catalog.maps.find(item => item.mapId === (inputs.map_id || workflow?.defaultInputsJson?.map_id));
      const robot = catalog.robots.find(item => item.robotId === schedule.robotId);
      const time = schedule.nextRunAt || schedule.startsAt;
      return <article key={schedule.scheduleId}><div><strong>{schedule.scheduleName}</strong><p>{map?.mapName || 'Bản đồ đã lưu'} · {robotName(robot)} · {schedule.scheduleType === 'ONCE' ? 'Một lần' : schedule.scheduleType === 'INTERVAL' ? `Mỗi ${schedule.intervalSec} giây` : `Cron ${schedule.cronExpression}`} · {schedule.status === 'ACTIVE' ? 'Đang kích hoạt' : 'Tạm dừng'}</p><p>{time ? new Date(time).toLocaleString('vi-VN') : 'Chưa có thời điểm'} · {schedule.timezone}</p>{inputs.checkpoints?.length > 0 && <details><summary>{inputs.checkpoints.length} điểm · {inputs.patrol_repeat_count === 0 ? 'Liên tục' : `${inputs.patrol_repeat_count ?? 1} vòng`} · {inputs.max_speed_mps ?? .25} m/s</summary><ol>{inputs.checkpoints.map((point, index) => <li key={index}>{patrolCheckpointLabel(point, catalog)}</li>)}</ol></details>}</div>{writable && <Button icon={schedule.status === 'ACTIVE' ? 'pause' : 'play'} disabled={!!busyId} onClick={() => changeState(schedule)}>{busyId === schedule.scheduleId ? 'Đang gửi…' : schedule.status === 'ACTIVE' ? 'Tạm dừng lịch' : 'Kích hoạt lịch'}</Button>}</article>;
    })}</div> : <p className="pt-schedules-empty">Chưa có lịch tuần tra đang hoạt động hoặc tạm dừng. Chọn “Tạo lượt tuần tra” để lập lịch.</p>}
  </section>;
}

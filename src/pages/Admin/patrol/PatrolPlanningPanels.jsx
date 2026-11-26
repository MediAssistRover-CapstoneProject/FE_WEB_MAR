import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { patrolApi } from '../../../features/patrol/patrolApi.js';
import { isPatrolWorkflow, patrolCheckpointLabel, patrolTemplateCount, scheduleTime, SENSING_OPTIONS } from '../../../features/patrol/patrolModel.js';
import PatrolMapPreview from './PatrolMapPreview.jsx';
import { Button, Empty, Icon } from './PatrolUi.jsx';
import PatrolScheduleDialog from './PatrolScheduleDialog.jsx';
import BrandMark from '../../../components/BrandMark.jsx';

export const robotName = robot => robot?.robotName || robot?.robotCode || 'Chưa phân công';
export const roundLabel = route => route?.continuous ? 'Liên tục đến khi dừng' : `${route?.repeatCount ?? 1} vòng`;
const robotStatuses = { IDLE: 'Sẵn sàng', BUSY: 'Đang làm nhiệm vụ', OFFLINE: 'Mất kết nối', CHARGING: 'Đang sạc', ERROR: 'Cần kiểm tra', MAINTENANCE: 'Bảo trì' };

const inactiveStatuses = { DRAFT: 'Bản nháp', VALIDATED: 'Đã kiểm tra', PUBLISHED: 'Ngừng nhận việc' };

export function RouteLibrary({ catalog, loading, error, workflows, workflowId, selectRoute, mapFilter, changeMap, search, setSearch, clearFilters, writable, preparing, onRefresh, onCreate }) {
  const readyCount = catalog.published.length;
  const publishedIds = new Set(catalog.published.map(item => item.workflowId));
  const inactive = catalog.workflows.filter(item => !publishedIds.has(item.workflowId) && !item.archivedAt && inactiveStatuses[item.status]);
  const create = writable && <Button icon="plus" tone="primary" disabled={preparing} onClick={onCreate}>Tạo tuyến tuần tra</Button>;
  const loadingFirst = loading && !readyCount && !inactive.length;
  return <section className="pt-card pt-library pt-route-library" aria-labelledby="pt-library-title" aria-busy={loading}>
    <div className="pt-index-heading">
      <div><h3 id="pt-library-title">Tuyến đã phát hành</h3>{!loadingFirst && !error && readyCount > 0 && <span className="pt-index-count" aria-label={`${readyCount} tuyến đã phát hành`}>{readyCount}</span>}</div>
      {!error && readyCount > 0 && create}
    </div>
    {error ? <div className="pt-library-message" role="alert"><Empty icon="info" title="Chưa tải được danh sách tuyến" action={<Button icon="refresh" onClick={onRefresh}>Thử lại</Button>}>{error}</Empty></div>
      : loadingFirst ? <p className="pt-loading" role="status">Đang tải các tuyến tuần tra…</p>
      : <>
        {readyCount > 0 ? <>
          <div className="pt-index-filters">
            <label className="pt-index-search"><Icon name="search"/><input type="search" aria-label="Tìm tuyến tuần tra" placeholder="Tìm tên hoặc mã tuyến" value={search} onChange={event => setSearch(event.target.value)}/></label>
            <label className="pt-index-map"><Icon name="map"/><select aria-label="Lọc tuyến theo bản đồ" disabled={catalog.metadataMissing} value={mapFilter} onChange={event => changeMap(event.target.value)}>
              <option value="">Tất cả bản đồ</option>{catalog.maps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName}{map.status !== 'ACTIVE' ? ' · Chưa kích hoạt' : ''}</option>)}
            </select></label>
          </div>
          {workflows.length ? <div className="pt-route-list">{workflows.map(workflow => {
            const selected = workflow.workflowId === workflowId;
            const map = catalog.maps.find(item => item.mapId === workflow.defaultInputsJson?.map_id);
            const count = patrolTemplateCount(workflow);
            return <button type="button" className={`pt-route-card${selected ? ' is-selected' : ''}`} key={workflow.workflowId}
              aria-pressed={selected} onClick={() => selectRoute(workflow.workflowId)}>
              <span className="pt-route-symbol"><Icon name={count ? 'loop' : 'route'}/></span>
              <span className="pt-route-card-copy"><strong>{workflow.workflowName}</strong>
                <span>{count ? `Mẫu ${count} điểm · Chọn bản đồ khi chạy` : map?.mapName || 'Xem bản đồ trong chi tiết tuyến'}</span>
                {workflow.workflowCode && <small>{workflow.workflowCode}</small>}
              </span>
              <span className="pt-route-indicator"><Icon name={selected ? 'check' : 'chevron'}/></span>
            </button>;
          })}</div> : <Empty icon="search" title="Không có tuyến phù hợp" action={<Button onClick={clearFilters}>Xóa bộ lọc</Button>}>Thử đổi bản đồ hoặc từ khóa tìm kiếm.</Empty>}
        </> : <div className="pt-library-message"><Empty title={inactive.length || catalog.metadataMissing ? 'Chưa có tuyến đã phát hành' : 'Chưa có tuyến tuần tra'} action={create}>
          {inactive.length ? 'Mở một tuyến bên dưới để tiếp tục soạn, hoặc tạo tuyến mới.' : writable ? 'Chọn bản đồ và các điểm robot sẽ ghé khi tạo tuyến.' : 'Các tuyến sẽ xuất hiện ở đây sau khi quản trị viên phát hành.'}
        </Empty></div>}
        {catalog.metadataMissing && <p className="pt-index-info" role="status">Chưa tải được thông tin bản đồ và các workflow chưa phát hành.</p>}
        {inactive.length > 0 && <details className="pt-inactive-routes" key={readyCount ? 'with-published' : 'only-drafts'} open={!readyCount}>
          <summary>Tuyến chưa sẵn sàng <span>({inactive.length})</span></summary>
          <ul>{inactive.map(item => <li key={item.workflowId}><Link to={`/workflow?workflowId=${encodeURIComponent(item.workflowId)}`}>{item.workflowName} <Icon name="arrow"/></Link><span>{inactiveStatuses[item.status]}</span></li>)}</ul>
        </details>}
      </>}
  </section>;
}

export function RouteMapPanel({ workflowId, detail, route, map, catalog, error, loading, snapshot, robot, targetEndpointId, onRefresh }) {
  const nonPatrol = detail && !isPatrolWorkflow(detail.workflow);
  if (route.template && route.managed && !error && !nonPatrol) return <section className="pt-card pt-route-detail" aria-label="Mẫu tuần tra">
    <div className="pt-card-heading"><div><span className="pt-eyebrow">MẪU THEO SỐ ĐIỂM</span><h3>{route.workflow.workflowName}</h3></div></div>
    <div className="pt-template-description">
      <dl className="pt-template-spec"><div><dt>Hành trình</dt><dd>{route.checkpointCount} điểm mỗi vòng</dd></div><div><dt>Hoạt động tại điểm</dt><dd>Phát hiện ngã · 3 giây</dd></div></dl>
      <p>Chọn bản đồ và điểm ghé khi cấu hình lượt chạy. Mỗi nhiệm vụ hoặc lịch giữ một hành trình riêng.</p>
      <Link to={`/workflow?workflowId=${encodeURIComponent(workflowId)}`}>Chi tiết quy trình →</Link>
    </div>
  </section>;
  return <section className="pt-card pt-route-detail" aria-label="Bản đồ và lộ trình tuần tra">
    <div className="pt-card-heading"><div><span className="pt-eyebrow">BẢN ĐỒ & LỘ TRÌNH</span><h3>{detail?.workflow?.workflowName || 'Hành trình tuần tra'}</h3></div>{detail && <span className={`pt-badge pt-badge-${route.published ? 'green' : 'neutral'}`}>{route.published ? 'Đã phát hành' : 'Chưa sẵn sàng chạy'}</span>}</div>
    {error ? <div className="pt-alert" role="alert"><span>Không tải được tuyến từ liên kết. {error}</span><Button icon="refresh" onClick={onRefresh}>Tải lại tuyến</Button></div> : nonPatrol ? <Empty title="Quy trình này không phải tuyến tuần tra">Chọn một tuyến tuần tra ở trên để tiếp tục.</Empty> : loading && workflowId ? <p className="pt-loading" role="status">Đang đọc bản đồ và các điểm của tuyến…</p> : !detail ? <Empty icon="map" title="Chọn tuyến để xem bản đồ">Bản đồ, các điểm kiểm tra và vị trí robot sẽ hiển thị tại đây.</Empty> : <>
      {!route.managed && <p className="pt-notice">Tuyến này dùng quy trình tùy chỉnh. {route.published && <Link to={`/admin/workflow-dispatch?workflowId=${encodeURIComponent(workflowId)}`}>Mở điều phối quy trình</Link>}</p>}
      <div className="pt-route-meta"><span><Icon name="map"/>{map?.mapName || 'Chưa tìm thấy bản đồ'}</span><span><Icon name="route"/>{route.checkpoints.length} điểm kiểm tra</span><span><Icon name="loop"/>{roundLabel(route)}</span></div>
      <PatrolMapPreview map={map} points={route.checkpoints.map(point => point.endpoint || { endpointId: point.endpointId })} zones={catalog.zones} snapshot={snapshot} robotName={robotName(robot)} targetEndpointId={targetEndpointId}/>
      <div className="pt-stop-heading"><h4>Thứ tự di chuyển</h4><span>Khởi hành từ vị trí thực tế của robot</span></div>
      {route.checkpoints.length ? <ol className="pt-checkpoints">{route.checkpoints.map((point, index) => <li key={point.stepId || index} className={targetEndpointId && targetEndpointId === point.endpointId ? 'is-current' : ''}><span className="pt-point-number">{index + 1}</span><div><strong>{point.endpoint?.endpointName || point.endpoint?.endpointCode || 'Điểm không còn khả dụng'}</strong><span>{SENSING_OPTIONS.find(option => option.value === point.sensingType)?.label || 'Di chuyển'}{point.windowSec ? ` · ${point.windowSec} giây` : ''}</span></div>{targetEndpointId === point.endpointId && <span className="pt-current-stop">Đang đến</span>}</li>)}</ol> : <p className="pt-muted">Tuyến chưa có điểm đến cố định.</p>}
      {!!route.issues.length && <div className="pt-notice" role="status">{route.issues.join(' ')}</div>}
      <div className="pt-map-footer"><span>Đường nối thể hiện thứ tự ghé điểm; robot tự lập đường đi trên bản đồ.</span><Link to={`/workflow?workflowId=${encodeURIComponent(workflowId)}`}>Chi tiết quy trình</Link></div>
    </>}
  </section>;
}

export function DispatchPanel({ catalog, route, map, robotId, onRobotChange, robot, snapshot, blocked, reasons, busy, pending, onReview, updatedAt, onConfigure, onSchedule, writable }) {
  const batteryValue = robot?.batteryPercent ?? snapshot?.latestTelemetry?.batteryPercent;
  const battery = batteryValue == null ? null : Number(batteryValue);
  if (route.template) return <aside className="pt-card pt-dispatch" aria-label="Cấu hình lượt tuần tra"><div className="pt-card-heading"><div><span className="pt-eyebrow">GIAO NHIỆM VỤ</span><h3>Cấu hình lượt tuần tra</h3></div><Icon name="robot"/></div><p className="pt-muted">Chọn robot và {route.checkpointCount} điểm ghé để chạy ngay hoặc lưu lịch.</p><Button icon="play" tone="primary" className="pt-dispatch-button" disabled={!writable || !route.published || pending} onClick={onConfigure}>Cấu hình & giao robot</Button></aside>;
  return <aside className="pt-card pt-dispatch" aria-label="Giao nhiệm vụ cho robot">
    <div className="pt-card-heading"><div><span className="pt-eyebrow">GIAO NHIỆM VỤ</span><h3>Robot thực hiện</h3></div><span className="pt-soft-icon"><Icon name="robot"/></span></div>
    <label className="pt-field"><span>Robot tuần tra</span><select aria-label="Robot tuần tra" value={robotId} onChange={event => onRobotChange(event.target.value)} disabled={busy || pending}><option value="">Chọn robot thực hiện</option>{catalog.robots.map(item => <option key={item.robotId} value={item.robotId}>{robotName(item)} · {robotStatuses[item.status] || item.status}</option>)}</select></label>
    {robot ? <div className="pt-robot-info"><span className="pt-robot-avatar"><BrandMark /></span><div><strong>{robotName(robot)}</strong><span>{robotStatuses[robot.status] || robot.status}{snapshot?.heartbeatFresh ? ' · Có kết nối' : ''}</span></div>{Number.isFinite(battery) && battery >= 0 && battery <= 100 && <span className="pt-battery">{Math.round(battery)}% pin</span>}</div> : <p className="pt-robot-placeholder">Chọn robot để kiểm tra kết nối, bản đồ và khả năng nhận việc.</p>}
    {robot && <div className={`pt-readiness ${!blocked ? 'is-ready' : ''}`} role="status"><Icon name={!blocked ? 'check' : 'info'}/><div><strong>{!blocked ? 'Sẵn sàng đưa vào hàng đợi' : 'Chưa thể bắt đầu'}</strong>{blocked ? <ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>Robot đã kết nối và đúng bản đồ. Máy chủ kiểm tra lại trước khi giao nhiệm vụ.</p>}</div></div>}
    <Button icon="play" tone="primary" className="pt-dispatch-button" disabled={blocked || busy || pending} onClick={onReview}>Bắt đầu tuần tra</Button>
    {route.managed && route.published && <Button icon="clock" onClick={onSchedule} disabled={!writable || !!route.issues.length || !map || map.status !== 'ACTIVE' || busy}>Lập lịch tuyến</Button>}
    <p className="pt-dispatch-note">Robot ưu tiên SOS và các yêu cầu hỗ trợ trước lượt tuần tra.</p>
    {updatedAt && <p className="pt-connection-time">Kết nối cập nhật lúc {new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
  </aside>;
}

export function PatrolSchedules({ loading, schedules = [], catalog, error, writable, retired, onViewChange, onRefresh, onNotice }) {
  const [busyId, setBusyId] = useState(''), [actionError, setActionError] = useState('');
  const locked = useRef(false);
  const [dialog, setDialog] = useState(null);
  const visible = schedules.filter(schedule => retired ? schedule.status === 'RETIRED' : ['ACTIVE', 'PAUSED'].includes(schedule.status));
  const changeState = async schedule => {
    if (locked.current) return;
    locked.current = true; setBusyId(schedule.scheduleId); setActionError('');
    try { await (schedule.status === 'ACTIVE' ? patrolApi.pauseSchedule : patrolApi.activateSchedule)(schedule.scheduleId); onRefresh(); }
    catch (cause) { setActionError(`${cause.message} Hãy cập nhật danh sách để xác nhận trạng thái lịch trước khi thao tác tiếp.`); onRefresh(); }
    finally { locked.current = false; setBusyId(''); }
  };
  return <section className="pt-card pt-schedules" aria-label="Lịch tuần tra">
    <div className="pt-card-heading">
      <div><span className="pt-eyebrow">LỊCH ĐÃ LƯU</span><h3>Lịch tuần tra <span className="pt-count">{visible.length}</span></h3></div>
      <div className="pt-actions">
        <Button aria-pressed={retired} onClick={() => onViewChange(!retired)}>{retired ? 'Xem lịch đang dùng' : 'Xem lịch đã ngừng'}</Button>
        <Button icon="refresh" onClick={onRefresh}>Cập nhật lịch</Button>
      </div>
    </div>
    {(error || actionError) && <p className="pt-alert" role="alert">{error || actionError}</p>}
    {loading && !visible.length ? <p className="pt-loading" role="status">Đang tải lịch tuần tra…</p> : visible.length ? <div className="pt-schedule-list">{visible.map(schedule => {
      const workflow = catalog.workflows.find(item => item.workflowId === schedule.workflowId);
      const inputs = schedule.inputTemplateJson || {};
      const map = catalog.maps.find(item => item.mapId === (inputs.map_id || workflow?.defaultInputsJson?.map_id));
      const robot = catalog.robots.find(item => item.robotId === schedule.robotId);
      const active = schedule.status === 'ACTIVE';
      const frequency = schedule.scheduleType === 'ONCE' ? 'Một lần' : schedule.scheduleType === 'INTERVAL' ? `Mỗi ${schedule.intervalSec} giây` : schedule.cronExpression;
      return <article key={schedule.scheduleId}>
        <div>
          <strong>{schedule.scheduleName}</strong>
          <p>{map?.mapName || 'Bản đồ đã lưu'} · {robotName(robot)} · {frequency} · {retired ? 'Đã ngừng sử dụng' : active ? 'Đang kích hoạt' : 'Tạm dừng'}</p>
          <p>{schedule.nextRunAt ? 'Lượt tiếp theo' : 'Bắt đầu'} · {scheduleTime(schedule.nextRunAt || schedule.startsAt, schedule.timezone)}</p>
          {inputs.checkpoints?.length > 0 && <details>
            <summary>{inputs.checkpoints.length} điểm · {inputs.patrol_repeat_count === 0 ? 'Liên tục' : `${inputs.patrol_repeat_count ?? 1} vòng`} · {inputs.max_speed_mps ?? .25} m/s</summary>
            <ol>{inputs.checkpoints.map((point, index) => <li key={index}>{patrolCheckpointLabel(point, catalog)}</li>)}</ol>
          </details>}
        </div>
        <div className="pt-actions">
          <Button onClick={() => setDialog({ id: schedule.scheduleId, kind: 'detail' })}>Chi tiết lịch</Button>
          {writable && !retired && <>
            <Button icon={active ? 'pause' : 'play'} disabled={!!busyId} onClick={() => changeState(schedule)}>
              {busyId === schedule.scheduleId ? 'Đang gửi…' : active ? 'Tạm dừng lịch' : 'Kích hoạt lịch'}
            </Button>
            <Button disabled={!!busyId} onClick={() => setDialog({ id: schedule.scheduleId, kind: 'retire' })}>Ngừng sử dụng</Button>
          </>}
        </div>
      </article>;
    })}</div> : !error && <p className="pt-schedules-empty">{retired ? 'Chưa có lịch tuần tra đã ngừng.' : 'Chưa có lịch tuần tra đang hoạt động hoặc tạm dừng. Chọn một tuyến hoặc mẫu để lập lịch.'}</p>}
    {dialog && <PatrolScheduleDialog key={dialog.id} scheduleId={dialog.id} retiring={dialog.kind === 'retire'} writable={writable}
      onClose={() => setDialog(null)} onRetired={() => { setDialog(null); onNotice('Đã ngừng sử dụng lịch tuần tra.'); onRefresh(); }}/>}
  </section>;
}

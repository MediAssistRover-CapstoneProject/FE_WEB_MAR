import { useEffect, useState } from 'react';
import { API_SELECTION_POLICIES } from '../../features/facility/endpointGroups.js';
import { Icon, Modal } from './patrol/PatrolUi.jsx';
import RoomEndpointPairForm from './RoomEndpointPairForm.jsx';
import { GroupForm, MemberForm, ReasonForm } from './EndpointGroupForms.jsx';
import './endpointGroupEditor.css';

const searchText = value => (value || '').toLocaleLowerCase('vi').normalize('NFD')
  .replace(/\p{M}/gu, '').replaceAll('đ', 'd').trim();

function Status({ active }) {
  return <span className={'eg-status' + (active ? ' is-active' : '')}>
    {active ? 'Đang bật' : 'Đã tắt'}
  </span>;
}

function GroupDetails({ group, endpoints, rooms, busy, readOnly, onLoadDetail, onAction }) {
  const [load, setLoad] = useState({ pending: true, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ pending: true, error: '' });
    onLoadDetail(group.id, { signal: controller.signal }).then(() => {
      if (!controller.signal.aborted) setLoad({ pending: false, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setLoad({ pending: false, error: error.message || 'Không tải được chi tiết nhóm.' });
    });
    return () => controller.abort();
  }, [group.id, onLoadDetail, revision]);

  const points = new Map(endpoints.map(point => [point.id, point]));
  const members = group.members;
  const room = rooms.find(item => item.roomId === group.roomId);
  const activeMembers = members.filter(member => member.active);
  const incompletePair = group.roomId && (activeMembers.length !== 2 || activeMembers.some((member, index) => {
    const point = points.get(member.endpointId);
    return member.sequenceNo !== index + 1 || point?.roomId !== group.roomId || !point?.enabled || !point?.accessible;
  }));
  const hasAvailablePoint = endpoints.some(point => (!group.roomId || point.roomId === group.roomId)
    && !members.some(item => item.endpointId === point.id));

  return <section className="eg-detail" aria-label="Chi tiết nhóm">
    <header className="eg-detail-header">
      <div className="eg-detail-identity"><span className="eg-symbol"><Icon name="route"/></span>
        <div><span className="eg-code">{group.code}</span><h4>{group.name}</h4></div>
      </div>
      <Status active={group.active}/>
    </header>
    {load.pending ? <p role="status" className="eg-note eg-load">Đang tải chi tiết nhóm…</p>
      : load.error ? <div className="eg-load"><p role="alert" className="eg-error">{load.error}</p>
        <button type="button" className="eg-button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
      : <>
        <dl className="eg-facts">
          <div><dt>Chính sách chọn điểm</dt><dd>{API_SELECTION_POLICIES[group.selectionPolicy] || group.selectionPolicy}</dd></div>
          <div><dt>Chuyển sang điểm dự phòng</dt><dd>{group.allowFallback ? 'Cho phép' : 'Đã tắt'}</dd></div>
          {group.roomId && <><div><dt>Phòng</dt><dd>{room?.roomName || group.roomId}{room?.defaultEndpointGroupId === group.id && ' · Nhóm mặc định'}</dd></div>
            <div><dt>Bán kính dự phòng</dt><dd>{Number(group.fallbackRadiusM).toLocaleString('vi')} m</dd></div></>}
        </dl>
        {group.description && <p className="eg-description">{group.description}</p>}
        {!readOnly && <div className="eg-detail-actions">
          <button type="button" className="eg-button" disabled={busy} onClick={() => onAction('edit')}>Chỉnh sửa nhóm</button>
          <button type="button" className="eg-button" disabled={busy} onClick={() => onAction('toggle')}>{group.active ? 'Tắt nhóm' : 'Bật nhóm'}</button>
        </div>}
        <section className="eg-members" aria-label="Thành viên nhóm">
          <div className="eg-members-heading"><h5>Thành viên <span className="eg-count">{members.length}</span></h5>
            {!readOnly && <button type="button" className="eg-button eg-add" disabled={busy || !hasAvailablePoint} onClick={() => onAction('member')}>
              <Icon name="plus"/>Thêm thành viên
            </button>}
          </div>
          {incompletePair && <p className="eg-pair-note">Để sử dụng cặp điểm, hãy bật hai điểm có thể tiếp cận trong cùng phòng. Điểm chính ở thứ tự 1 và điểm dự phòng ở thứ tự 2.</p>}
          {!members.length ? <div className="eg-member-empty">
            <strong>Nhóm chưa có thành viên</strong>
            <p>{hasAvailablePoint ? 'Thêm điểm đích để robot có thể chọn điểm trong nhóm này.' : 'Cần tạo điểm đích trong phạm vi của nhóm trước khi thêm thành viên.'}</p>
          </div> : <table className="eg-table" aria-label="Danh sách thành viên">
            <thead><tr><th scope="col">Thứ tự</th><th scope="col">Điểm đích</th><th scope="col">Trạng thái</th>{!readOnly && <th scope="col">Thao tác</th>}</tr></thead>
            <tbody>{members.map(member => {
              const point = points.get(member.endpointId);
              return <tr key={member.endpointId}>
                <td><span className="eg-sequence">{member.sequenceNo}</span></td>
                <th scope="row"><strong>{point?.name || member.endpointId}</strong>
                  <small>{[point?.code, group.roomId && ({ 1: 'Điểm chính', 2: 'Điểm dự phòng' })[member.sequenceNo]].filter(Boolean).join(' · ')}</small>
                  {point && (!point.enabled || !point.accessible) && <small>{!point.enabled ? 'Điểm đích đã tắt' : 'Điểm đích không thể tiếp cận'}</small>}
                </th>
                <td><Status active={member.active}/></td>
                {!readOnly && <td><div className="eg-row-actions">
                  <button type="button" className="eg-link" disabled={busy} onClick={() => onAction('member', member)}>Chỉnh sửa</button>
                  {member.active && <button type="button" className="eg-link eg-muted" disabled={busy} onClick={() => onAction('remove', member)}>Tắt thành viên</button>}
                </div></td>}
              </tr>;
            })}</tbody>
          </table>}
        </section>
      </>}
  </section>;
}

export default function EndpointGroupEditor({
  groups, endpoints, rooms, mapId, mapName, busy, readOnly,
  onLoadDetail, onSave, onSetActive, onCreatePair, onMember, onRemove,
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [action, setAction] = useState(null);
  const term = searchText(query);
  const visible = groups.filter(group => (status === 'all' || group.active === (status === 'active'))
    && searchText(group.name + ' ' + group.code).includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.code.localeCompare(b.code, 'vi'));
  const selected = visible.find(group => group.id === selectedId) || visible[0];
  // Keep the user's selection if a rename or a new group changes the sort order.
  const visibleId = selected?.id;
  useEffect(() => { if (visibleId) setSelectedId(visibleId); }, [visibleId]);
  const target = action?.groupId && groups.find(group => group.id === action.groupId);
  const member = target?.members?.find(item => item.endpointId === action.endpointId);
  const pointName = member && (endpoints.find(point => point.id === member.endpointId)?.name || member.endpointId);
  const close = () => setAction(null);
  const showGroup = group => {
    setQuery('');
    setStatus('all');
    setSelectedId(group.id);
    close();
  };
  const titles = { create: 'Tạo nhóm điểm đích', pair: 'Tạo cặp điểm cho phòng', edit: 'Chỉnh sửa nhóm',
    member: member ? 'Chỉnh sửa thành viên' : 'Thêm thành viên', toggle: target?.active ? 'Tắt nhóm' : 'Bật nhóm', remove: 'Tắt thành viên' };
  const locked = busy || readOnly;

  return <section className="eg-workspace" aria-label="Quản lý nhóm điểm đích">
    <header className="eg-header">
      <div><h3>Nhóm điểm đích</h3><p className="eg-map"><Icon name="map"/>{mapName}</p></div>
      {!readOnly && <div className="eg-toolbar">
        <button type="button" className="eg-button" disabled={busy} onClick={() => setAction({ type: 'pair' })}><Icon name="route"/>Tạo cặp điểm cho phòng</button>
        <button type="button" className="eg-button eg-primary" disabled={busy} onClick={() => setAction({ type: 'create' })}><Icon name="plus"/>Tạo nhóm</button>
      </div>}
    </header>
    {groups.length ? <div className="eg-columns">
      <aside className="eg-sidebar" aria-label="Danh sách nhóm">
        <div className="eg-sidebar-heading"><h4>Danh sách nhóm</h4><span className="eg-count">{visible.length}</span></div>
        <div className="eg-search"><Icon name="search"/><input type="search" aria-label="Tìm nhóm" placeholder="Tìm tên hoặc mã nhóm" value={query} onChange={event => setQuery(event.target.value)}/></div>
        <select className="eg-filter" aria-label="Lọc trạng thái nhóm" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">Tất cả trạng thái</option><option value="active">Đang bật</option><option value="inactive">Đã tắt</option>
        </select>
        <div className="eg-group-list">{visible.map(group => <button type="button" key={group.id}
          className="eg-group-item" aria-current={group.id === selected?.id ? 'true' : undefined} onClick={() => setSelectedId(group.id)}>
          <span className="eg-item-top"><strong>{group.name}</strong><Icon name="chevron"/></span>
          <span className="eg-code">{group.code}</span>
          <span className="eg-item-meta"><Status active={group.active}/><span>{group.members.length} điểm</span></span>
        </button>)}</div>
      </aside>
      {selected ? <GroupDetails key={selected.id} group={selected} endpoints={endpoints} rooms={rooms}
        busy={busy} readOnly={readOnly} onLoadDetail={onLoadDetail}
        onAction={(type, item) => setAction({ type, groupId: selected.id, endpointId: item?.endpointId })}/>
        : <div className="eg-empty"><Icon name="search"/><h4>Không tìm thấy nhóm phù hợp</h4>
          <button type="button" className="eg-button" onClick={() => { setQuery(''); setStatus('all'); }}>Xóa bộ lọc</button></div>}
    </div> : <div className="eg-empty"><span className="eg-symbol"><Icon name="route"/></span>
      <h4>Bản đồ này chưa có nhóm điểm đích</h4>
      {!readOnly && <p>Tạo nhóm để chọn các điểm cùng chức năng, hoặc tạo cặp điểm chính và dự phòng cho một phòng.</p>}
    </div>}
    {action && <Modal title={titles[action.type]} subtitle={target?.name || mapName} busy={busy} onClose={close}>
      {action.type === 'pair' && <RoomEndpointPairForm rooms={rooms} endpoints={endpoints} mapId={mapId} groups={groups}
        busy={locked} onCreatePair={onCreatePair} onCreated={showGroup} onCancel={close}/>}
      {(action.type === 'create' || (action.type === 'edit' && target)) && <GroupForm group={target || null} groups={groups}
        busy={locked} onCancel={close} onSubmit={async draft => showGroup(await onSave(draft))}/>}
      {action.type === 'member' && target && <MemberForm group={target} member={member} endpoints={endpoints}
        busy={locked} onCancel={close} onSubmit={async draft => { await onMember(target, draft, Boolean(member)); close(); }}/>}
      {action.type === 'toggle' && target && <ReasonForm busy={locked} onCancel={close}
        prompt={target.active ? 'Tắt nhóm này trong điều phối.' : 'Cho phép điều phối sử dụng lại nhóm này.'}
        onSubmit={async reason => { await onSetActive(target, !target.active, reason); close(); }}/>}
      {action.type === 'remove' && member && <ReasonForm busy={locked} onCancel={close}
        prompt={'Tắt điểm “' + pointName + '” trong nhóm này. Bạn có thể bật lại trong phần chỉnh sửa thành viên.'}
        onSubmit={async reason => { await onRemove(target, member, reason); close(); }}/>}
    </Modal>}
  </section>;
}

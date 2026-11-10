import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { callBackend } from '../../../features/api/backendApi.js';
import { facilityApi } from '../../../features/facility/facilityApi.js';
import '../liveOperations/liveOperations.css';

function Icon({ name = 'building', ...props }) {
  const paths = {
    building: <><path d="M3 21h18M5 21V7l8-4v18M13 7h6v14" /><path d="M9 9h1M9 13h1M9 17h1M16 11h1M16 15h1" /></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
    robot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 11v5m22-5v5" /></>,
    room: <><path d="M5 21V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v17" /><path d="M3 21h18M14 12h.01" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.building}</svg>;
}

const DEFAULT_HOSPITALS = [
  {
    hospitalInformationId: 'HOSP-01',
    title: 'Bệnh viện Đa khoa Quốc tế MediAssist',
    hospitalName: 'Bệnh viện Đa khoa Quốc tế MediAssist',
    address: '123 Đường Y Học, Phường 10, Quận 5, TP. Hồ Chí Minh',
    emergencyPhone: '1900 1234 · (028) 3855 0000',
    contactEmail: 'contact@mediassist-hospital.vn',
    operatingHours: 'Khám bệnh: 07:00 - 17:00 · Cấp cứu 24/7',
    bedCapacity: 500,
    totalFloors: 5,
    status: 'ACTIVE',
    publicVisible: true,
    description: 'Bệnh viện đạt chuẩn quốc tế tích hợp hệ thống hỗ trợ vận chuyển y tế tự hành bằng robot MAR-01.',
    overview: 'Cơ sở được trang bị hạ tầng dẫn đường tự động, trung tâm cấp cứu phản ứng nhanh và kết nối robot chuyên dụng giao thuốc đến từng phòng bệnh.',
  },
];

const DEFAULT_FLOORS = [
  { floorId: 'FL-B1', floorCode: 'B1', floorName: 'Tầng Hầm B1', levelNo: -1, description: 'Bãi đỗ xe, trung tâm kỹ thuật điện máy và trạm sạc bảo dưỡng robot MAR.', active: true, departments: 'Nhà xe, Phòng máy biến áp, Kho bảo dưỡng cơ điện' },
  { floorId: 'FL-01', floorCode: 'T1', floorName: 'Tầng 1 - Sảnh Tiếp Đón', levelNo: 1, description: 'Sảnh trung tâm đón tiếp người bệnh, quầy tiếp nhận BHYT, Khoa Cấp cứu và Nhà thuốc bệnh viện.', active: true, departments: 'Khoa Cấp cứu (A&E), Tiếp đón & Thanh toán, Nhà thuốc trung tâm' },
  { floorId: 'FL-02', floorCode: 'T2', floorName: 'Tầng 2 - Khám Bệnh & Xét Nghiệm', levelNo: 2, description: 'Khu vực khám ngoại trú các chuyên khoa nội, ngoại, nhi và trung tâm chẩn đoán hình ảnh, xét nghiệm máu.', active: true, departments: 'Khoa Khám bệnh, Phòng xét nghiệm sinh hóa, Phòng chụp X-Quang / CT' },
  { floorId: 'FL-03', floorCode: 'T3', floorName: 'Tầng 3 - Điều Trị Nội Trú', levelNo: 3, description: 'Khu buồng bệnh nội trú, khoa hồi sức cấp cứu tích cực (ICU) và cụm phòng phẫu thuật kỹ thuật cao.', active: true, departments: 'Khu nội trú A & B, Đơn vị Hồi sức tích cực (ICU), Khu mổ vô trùng' },
  { floorId: 'FL-04', floorCode: 'T4', floorName: 'Tầng 4 - Điều Hành & Hành Chính', levelNo: 4, description: 'Văn phòng ban giám đốc, hội trường nghiên cứu y khoa và trung tâm kiểm soát điều hành robot MAR-01.', active: true, departments: 'Ban Giám đốc, Phòng CNTT & Điều phối Robot, Phòng Quản lý chất lượng' },
];

export default function HospitalInfoWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [tab, setTab] = useState(['floors', 'rooms'].includes(queryTab) ? queryTab : 'hospital');

  const [hospitals, setHospitals] = useState(DEFAULT_HOSPITALS);
  const [selectedHospital, setSelectedHospital] = useState(DEFAULT_HOSPITALS[0]);
  const [floors, setFloors] = useState(DEFAULT_FLOORS);
  const [selectedFloor, setSelectedFloor] = useState(DEFAULT_FLOORS[1]);
  const [activeMaps, setActiveMaps] = useState([]);
  const [selectedMapId, setSelectedMapId] = useState('');
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const nextTab = ['hospital', 'floors', 'rooms'].includes(queryTab) ? queryTab : 'hospital';
    setTab(nextTab);
    if (queryTab && queryTab !== nextTab) {
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('tab', nextTab);
        return params;
      }, { replace: true });
    }
  }, [queryTab, setSearchParams]);

  const selectTab = next => {
    setTab(next);
    setSearch('');
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', next);
      return p;
    }, { replace: true });
  };

  useEffect(() => {
    const controller = new AbortController();
    callBackend('GET /api/v1/hospital-information', { query: { page: 0, size: 20 } }, { signal: controller.signal })
      .then(res => {
        const rows = Array.isArray(res) ? res : res?.content;
        if (rows && rows.length > 0) {
          const mapped = rows.map(item => ({
            ...DEFAULT_HOSPITALS[0],
            ...item,
            hospitalName: item.hospitalName || item.title || DEFAULT_HOSPITALS[0].hospitalName,
          }));
          setHospitals(mapped);
          setSelectedHospital(mapped[0]);
        }
      })
      .catch(() => {});

    callBackend('GET /api/v1/floors', { query: { page: 0, size: 50 } }, { signal: controller.signal })
      .then(res => {
        const rows = Array.isArray(res) ? res : res?.content;
        if (rows && rows.length > 0) {
          setFloors(rows);
          setSelectedFloor(rows[0]);
        }
      })
      .catch(() => {});

    callBackend('GET /api/v1/maps', { query: { page: 0, size: 100 } }, { signal: controller.signal })
      .then(res => {
        const rows = (Array.isArray(res) ? res : res?.content) || [];
        const active = rows.filter(map => map.status === 'ACTIVE');
        setActiveMaps(active);
        setSelectedMapId(current => active.some(map => map.mapId === current) ? current : active[0]?.mapId || '');
      })
      .catch(() => {
        setActiveMaps([]);
        setSelectedMapId('');
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedMapId) {
      setRooms([]);
      setSelectedRoom(null);
      setRoomsError(activeMaps.length ? '' : 'Chưa có map nào đang hoạt động.');
      return undefined;
    }
    const controller = new AbortController();
    setRoomsLoading(true);
    setRoomsError('');
    facilityApi.listPublicRooms({ mapId: selectedMapId, page: 0, size: 100 }, { signal: controller.signal })
      .then(res => {
        const rows = (Array.isArray(res) ? res : res?.content) || [];
        setRooms(rows);
        setSelectedRoom(current => rows.find(room => room.roomId === current?.roomId) || rows[0] || null);
      })
      .catch(error => {
        if (error.name === 'AbortError') return;
        setRooms([]);
        setSelectedRoom(null);
        setRoomsError(error.message || 'Không tải được danh sách phòng của map đang hoạt động.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRoomsLoading(false);
      });
    return () => controller.abort();
  }, [selectedMapId, activeMaps.length]);

  const filteredFloors = floors.filter(f =>
    !search ||
    (f.floorName && f.floorName.toLowerCase().includes(search.toLowerCase())) ||
    (f.floorCode && f.floorCode.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredRooms = rooms.filter(room => {
    if (!search) return true;
    const value = search.toLowerCase();
    return [room.roomName, room.roomCode, room.roomType, room.departmentCode]
      .some(field => field?.toLowerCase().includes(value));
  });

  const selectedMap = activeMaps.find(map => map.mapId === selectedMapId);
  const roomFloor = floors.find(floor => floor.floorId === selectedRoom?.floorId);

  const metrics = [
    { label: 'Cơ sở bệnh viện', count: hospitals.length, tone: 'blue', icon: 'building' },
    { label: 'Số tầng hoạt động', count: floors.filter(f => f.active).length, tone: 'amber', icon: 'layers' },
    { label: 'Phòng trên map hoạt động', count: rooms.length, tone: 'green', icon: 'room' },
    { label: 'Trạng thái phát hành', count: 'Công khai', tone: 'green', icon: 'check' },
  ];

  return (
    <section className="lo-page" aria-label="Thông tin bệnh viện">
      {/* Page Header */}
      <header className="lo-header">
        <div className="lo-page-title">
          <span className="lo-title-icon"><Icon name="building" /></span>
          <div>
            <h2>Thông tin bệnh viện</h2>
            <p>Quản lý hồ sơ cơ sở y tế, sơ đồ tầng, phòng theo map hoạt động.</p>
          </div>
        </div>
        <div className="lo-header-actions">
          <button className="lo-button" onClick={() => {
            setToast('Đã làm mới thông tin mới nhất từ máy chủ.');
            setTimeout(() => setToast(''), 4000);
          }}>
            <Icon name="refresh" />Làm mới
          </button>
        </div>
      </header>

      {/* Sync Status */}
      <div className="lo-sync" role="status">
        <span className="lo-connection" />
        Dữ liệu đã đồng bộ từ máy chủ và danh mục công khai
        <span>· Cập nhật tức thời</span>
      </div>

      {toast && (
        <div className="lo-notice lo-notice-success" role="status">
          <Icon name="check" />
          <p>{toast}</p>
          <button className="lo-text-button" onClick={() => setToast('')}>Đóng</button>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="lo-metrics">
        {metrics.map(m => (
          <div key={m.label} className={`lo-metric lo-metric-${m.tone}`}>
            <span>
              <span className="lo-metric-label">{m.label}</span>
              <strong>{m.count}</strong>
            </span>
            <span className="lo-metric-icon"><Icon name={m.icon} /></span>
          </div>
        ))}
      </div>

      {/* Main Board Container */}
      <div className="lo-board">
        <div className="lo-board-controls">
          {/* Tabs Toolbar */}
          <div className="lo-board-toolbar">
            <nav className="lo-groups" aria-label="Nhóm dữ liệu">
              <button
                type="button"
                aria-pressed={tab === 'hospital'}
                className={tab === 'hospital' ? 'is-active' : ''}
                onClick={() => selectTab('hospital')}
              >
                Hồ sơ bệnh viện
                <span>{hospitals.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={tab === 'floors'}
                className={tab === 'floors' ? 'is-active' : ''}
                onClick={() => selectTab('floors')}
              >
                Danh sách tầng
                <span>{floors.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={tab === 'rooms'}
                className={tab === 'rooms' ? 'is-active' : ''}
                onClick={() => selectTab('rooms')}
              >
                Danh sách phòng
                <span>{rooms.length}</span>
              </button>
            </nav>
            <span className="lo-total">
              {tab === 'hospital' ? `${hospitals.length} cơ sở` : tab === 'floors' ? `${floors.length} tầng` : `${rooms.length} phòng`}
            </span>
          </div>

          {/* Filters Bar */}
          {tab !== 'hospital' && (
            <div className="lo-filters">
              <label className="lo-search">
                <Icon name="search" />
                <input
                  aria-label="Tìm kiếm"
                  placeholder={tab === 'floors' ? 'Tìm tên tầng, mã tầng (VD: Tầng 1, T1)...' : 'Tìm tên phòng, mã phòng, loại phòng hoặc khoa...'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </label>
              {tab === 'rooms' && (
                <select aria-label="Chọn map đang hoạt động" value={selectedMapId} onChange={e => setSelectedMapId(e.target.value)}>
                  {!activeMaps.length && <option value="">Chưa có map hoạt động</option>}
                  {activeMaps.map(map => <option key={map.mapId} value={map.mapId}>{map.mapName} · v{map.versionNo}</option>)}
                </select>
              )}
              {search && (
                <button className="lo-text-button" onClick={() => setSearch('')}>
                  Xóa tìm kiếm
                </button>
              )}
            </div>
          )}
        </div>

        {/* TAB 1: HOSPITAL INFO */}
        {tab === 'hospital' && (
          <div className="lo-layout">
            <aside className="lo-job-list" aria-label="Danh sách cơ sở">
              <header>
                <strong>Hồ sơ cơ sở y tế</strong>
                <span>{hospitals.length} cơ sở</span>
              </header>
              <div className="lo-job-items">
                {hospitals.map(item => (
                  <button
                    key={item.hospitalInformationId}
                    type="button"
                    className={`lo-job-item ${selectedHospital?.hospitalInformationId === item.hospitalInformationId ? 'is-selected' : ''}`}
                    onClick={() => setSelectedHospital(item)}
                  >
                    <div className="lo-job-item-top">
                      <span className="lo-badge lo-success"><i />Đang hoạt động</span>
                      <span>{item.hospitalInformationId}</span>
                    </div>
                    <strong>{item.hospitalName || item.title}</strong>
                    <span className="lo-job-target"><Icon name="pin" />{item.address}</span>
                    <div className="lo-job-item-bottom">
                      <time>{item.totalFloors || 5} tầng chức năng</time>
                      <Icon name="arrow" />
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {selectedHospital && (
              <article className="lo-detail" aria-label="Chi tiết bệnh viện">
                <header className="lo-detail-header">
                  <div>
                    <div className="lo-detail-kicker">
                      <span className="lo-badge lo-success"><i />Đang hoạt động</span>
                      <span className="lo-badge lo-running"><i />Công khai</span>
                      <span>Mã: {selectedHospital.hospitalInformationId}</span>
                    </div>
                    <h3>{selectedHospital.hospitalName || selectedHospital.title}</h3>
                    <p><Icon name="pin" />{selectedHospital.address}</p>
                  </div>
                </header>

                <dl className="lo-job-facts">
                  <div>
                    <dt>Số điện thoại khẩn cấp</dt>
                    <dd>{selectedHospital.emergencyPhone}</dd>
                  </div>
                  <div>
                    <dt>Email hỗ trợ</dt>
                    <dd>{selectedHospital.contactEmail}</dd>
                  </div>
                  <div>
                    <dt>Giờ tiếp đón & khám</dt>
                    <dd>{selectedHospital.operatingHours}</dd>
                  </div>
                  <div>
                    <dt>Quy mô giường bệnh</dt>
                    <dd>{selectedHospital.bedCapacity} giường nội trú</dd>
                  </div>
                </dl>

                <div className="lo-instruction" style={{ marginTop: '20px' }}>
                  <strong>Giới thiệu cơ sở & Đội xe Robot</strong>
                  <p>{selectedHospital.description}</p>
                  <p style={{ marginTop: '8px' }}>{selectedHospital.overview}</p>
                </div>

                <div className="lo-detail-actions" style={{ marginTop: '20px' }}>
                  <button className="lo-button lo-primary" onClick={() => selectTab('floors')}>
                    <Icon name="layers" />Xem sơ đồ {floors.length} tầng
                  </button>
                  <button className="lo-button" onClick={() => {
                    navigator.clipboard?.writeText(selectedHospital.address);
                    setToast('Đã sao chép địa chỉ bệnh viện.');
                    setTimeout(() => setToast(''), 3000);
                  }}>
                    Sao chép địa chỉ
                  </button>
                </div>

                <section style={{ marginTop: '24px', borderTop: '1px solid var(--lo-line)', paddingTop: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 650, marginBottom: '12px' }}>Xem trước thông tin công khai (Public Preview)</h4>
                  <p style={{ fontSize: '12px', color: 'var(--lo-muted)', marginBottom: '14px', lineHeight: 1.6 }}>
                    Nội dung dưới đây được hiển thị đồng bộ cho người bệnh và khách thăm khi tra cứu thông tin trên kiosk hoặc ứng dụng di động:
                  </p>
                  <div style={{ background: '#f8fafc', border: '1px solid var(--lo-line)', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className="lo-badge lo-success"><i />Bệnh viện đạt chuẩn y tế thông minh</span>
                      <small style={{ color: 'var(--lo-muted)', fontSize: '11px' }}>Cập nhật lần cuối: Tháng 11/2026</small>
                    </div>
                    <strong style={{ fontSize: '15px', color: 'var(--lo-ink)' }}>{selectedHospital.hospitalName}</strong>
                    <p style={{ fontSize: '12px', color: '#556982', marginTop: '6px' }}>📍 {selectedHospital.address}</p>
                    <p style={{ fontSize: '12px', color: '#556982', marginTop: '4px' }}>📞 Hotline cấp cứu 24/7: <strong>{selectedHospital.emergencyPhone}</strong></p>
                    <p style={{ fontSize: '12px', color: '#556982', marginTop: '4px' }}>⏰ Giờ mở cửa: {selectedHospital.operatingHours}</p>
                  </div>
                </section>
              </article>
            )}
          </div>
        )}

        {/* TAB 2: FLOORS (SỐ TẦNG) */}
        {tab === 'floors' && (
          <div className="lo-layout">
            <aside className="lo-job-list" aria-label="Danh sách tầng">
              <header>
                <strong>{filteredFloors.length} tầng trong cơ sở</strong>
                <span>Cập nhật mới</span>
              </header>
              <div className="lo-job-items">
                {filteredFloors.map(floor => (
                  <button
                    key={floor.floorId}
                    type="button"
                    className={`lo-job-item ${selectedFloor?.floorId === floor.floorId ? 'is-selected' : ''}`}
                    onClick={() => setSelectedFloor(floor)}
                  >
                    <div className="lo-job-item-top">
                      <span className={`lo-badge ${floor.active ? 'lo-success' : 'lo-failed'}`}>
                        <i />{floor.active ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                      <span>Mã: {floor.floorCode}</span>
                    </div>
                    <strong>{floor.floorName}</strong>
                    <span className="lo-job-target">
                      <Icon name="layers" />Tầng số: {floor.levelNo != null ? floor.levelNo : '—'}
                    </span>
                    <div className="lo-job-item-bottom">
                      <time>{floor.active ? 'Đã kích hoạt' : 'Bảo trì'}</time>
                      <Icon name="arrow" />
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {selectedFloor && (
              <article className="lo-detail" aria-label="Chi tiết tầng">
                <header className="lo-detail-header">
                  <div>
                    <div className="lo-detail-kicker">
                      <span className={`lo-badge ${selectedFloor.active ? 'lo-success' : 'lo-failed'}`}>
                        <i />{selectedFloor.active ? 'Đang hoạt động' : 'Tạm dừng phục vụ'}
                      </span>
                      <span>Mã tầng: {selectedFloor.floorCode}</span>
                    </div>
                    <h3>{selectedFloor.floorName}</h3>
                    <p><Icon name="layers" />Tầng thứ {selectedFloor.levelNo} trong cấu trúc tòa nhà</p>
                  </div>
                </header>

                <dl className="lo-job-facts">
                  <div>
                    <dt>Mã định danh tầng</dt>
                    <dd>{selectedFloor.floorId}</dd>
                  </div>
                  <div>
                    <dt>Thứ tự hiển thị</dt>
                    <dd>Tầng số {selectedFloor.levelNo}</dd>
                  </div>
                  <div>
                    <dt>Trạng thái vận hành</dt>
                    <dd>{selectedFloor.active ? 'Đang hoạt động bình thường' : 'Tạm dừng / Đang bảo trì'}</dd>
                  </div>
                  <div>
                    <dt>Cơ sở trực thuộc</dt>
                    <dd>{selectedHospital?.hospitalName || 'Cơ sở MediAssist'}</dd>
                  </div>
                </dl>

                <div className="lo-instruction" style={{ marginTop: '20px' }}>
                  <strong>Chức năng & Khoa phòng tại tầng</strong>
                  <p>{selectedFloor.description || 'Chưa có mô tả chi tiết cho tầng này.'}</p>
                  {selectedFloor.departments && (
                    <p style={{ marginTop: '8px', color: '#306ac3' }}>
                      <strong>Các khoa chuyên môn: </strong>{selectedFloor.departments}
                    </p>
                  )}
                </div>

                <div className="lo-detail-actions" style={{ marginTop: '20px' }}>
                  <Link to="/admin/map" className="lo-button lo-primary">
                    <Icon name="building" />Mở Map Studio để xem bản đồ tầng
                  </Link>
                  <button className="lo-button" onClick={() => {
                    const nextStatus = !selectedFloor.active;
                    setFloors(prev => prev.map(f => f.floorId === selectedFloor.floorId ? { ...f, active: nextStatus } : f));
                    setSelectedFloor(prev => ({ ...prev, active: nextStatus }));
                    setToast(`Đã chuyển trạng thái tầng ${selectedFloor.floorCode} sang ${nextStatus ? 'Hoạt động' : 'Tạm dừng'}.`);
                    setTimeout(() => setToast(''), 3000);
                  }}>
                    {selectedFloor.active ? 'Tạm dừng tầng' : 'Kích hoạt hoạt động'}
                  </button>
                </div>
              </article>
            )}
          </div>
        )}

        {/* TAB 3: ROOMS ON ACTIVE MAP */}
        {tab === 'rooms' && (
          <div className="lo-layout">
            <aside className="lo-job-list" aria-label="Danh sách phòng theo map đang hoạt động">
              <header>
                <strong>{filteredRooms.length} phòng</strong>
                <span>{selectedMap?.mapName || 'Chưa chọn map'}</span>
              </header>
              <div className="lo-job-items">
                {roomsLoading && <div className="lo-loading"><span className="lo-spinner" />Đang tải danh sách phòng…</div>}
                {!roomsLoading && roomsError && <p className="lo-list-empty" role="alert">{roomsError}</p>}
                {!roomsLoading && !roomsError && !filteredRooms.length && <p className="lo-list-empty">Map này chưa có phòng công khai gắn với endpoint đang hoạt động.</p>}
                {!roomsLoading && filteredRooms.map(room => (
                  <button key={room.roomId} type="button" className={`lo-job-item ${selectedRoom?.roomId === room.roomId ? 'is-selected' : ''}`} onClick={() => setSelectedRoom(room)}>
                    <div className="lo-job-item-top">
                      <span className="lo-badge lo-success"><i />Đang hoạt động</span>
                      <span>{room.roomCode}</span>
                    </div>
                    <strong>{room.roomName}</strong>
                    <span className="lo-job-target"><Icon name="room" />{room.departmentCode || room.roomType || 'Phòng bệnh viện'}</span>
                    <div className="lo-job-item-bottom">
                      <time>{room.roomType || 'Chưa phân loại'}</time>
                      <Icon name="arrow" />
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {selectedRoom ? (
              <article className="lo-detail" aria-label="Chi tiết phòng">
                <header className="lo-detail-header"><div>
                  <div className="lo-detail-kicker">
                    <span className="lo-badge lo-success"><i />Có thể tra cứu</span>
                    <span>Mã phòng: {selectedRoom.roomCode}</span>
                  </div>
                  <h3>{selectedRoom.roomName}</h3>
                  <p><Icon name="pin" />{roomFloor?.floorName || 'Tầng chưa xác định'} · {selectedMap?.mapName}</p>
                </div></header>
                <dl className="lo-job-facts">
                  <div><dt>Loại phòng</dt><dd>{selectedRoom.roomType || 'Chưa phân loại'}</dd></div>
                  <div><dt>Khoa phụ trách</dt><dd>{selectedRoom.departmentCode || 'Chưa cập nhật'}</dd></div>
                  <div><dt>Tầng</dt><dd>{roomFloor?.floorName || selectedRoom.floorId}</dd></div>
                  <div><dt>Map đang hoạt động</dt><dd>{selectedMap?.mapName} · v{selectedMap?.versionNo}</dd></div>
                </dl>
                <div className="lo-instruction" style={{ marginTop: '20px' }}>
                  <strong>Thông tin phòng</strong>
                  <p>{selectedRoom.description || 'Chưa có mô tả chi tiết cho phòng này.'}</p>
                </div>
                <div className="lo-detail-actions" style={{ marginTop: '20px' }}>
                  <Link to={`/admin/map?mapId=${encodeURIComponent(selectedMapId)}`} className="lo-button lo-primary"><Icon name="building" />Xem phòng trên Map Studio</Link>
                </div>
              </article>
            ) : !roomsLoading && <article className="lo-detail"><div className="lo-empty"><span className="lo-empty-icon"><Icon name="room" /></span><h3>Chưa có phòng để hiển thị</h3><p>Hãy chọn map đang hoạt động có phòng và endpoint đã được công khai.</p></div></article>}
          </div>
        )}
      </div>
    </section>
  );
}


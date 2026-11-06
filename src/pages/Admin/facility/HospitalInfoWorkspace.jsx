import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { callBackend } from '../../../features/api/backendApi.js';
import { getSession } from '../../../features/auth/session.js';
import { vi } from '../../../i18n/vi.js';
import '../liveOperations/liveOperations.css';

function Icon({ name = 'building', ...props }) {
  const paths = {
    building: <><path d="M3 21h18M5 21V7l8-4v18M13 7h6v14" /><path d="M9 9h1M9 13h1M9 17h1M16 11h1M16 15h1" /></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
    book: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" /><path d="M6 6h10M6 10h10" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
    robot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 11v5m22-5v5" /></>,
    alert: <><path d="m12 3 10 18H2Z" /><path d="M12 9v4m0 3v1" /></>,
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

const HARDCODED_ARTICLES = [
  {
    id: 'ART-01',
    code: 'HD-001',
    category: 'Tiếp đón & Hướng dẫn',
    title: 'Quy trình tiếp đón người bệnh và đăng ký khám tại sảnh chính',
    updatedAt: 'Hôm nay · 08:30',
    status: 'PUBLISHED',
    readCount: 1420,
    summary: 'Hướng dẫn các bước lấy số tự động, quét mã bảo hiểm và cách nhờ robot MAR-01 dẫn đường đến phòng khám.',
    content: [
      { heading: '1. Tiếp cận sảnh chính và lấy số thứ tự', text: 'Khi bước vào sảnh tầng 1, người bệnh quét thẻ Căn cước công dân gắn chip hoặc ứng dụng VssID tại cây lấy số tự động để nhận phiếu khám bệnh.' },
      { heading: '2. Nhờ robot hỗ trợ dẫn đường', text: 'Robot MAR-01 túc trực tại sảnh chính sẵn sàng hướng dẫn di chuyển. Người bệnh chạm vào màn hình cảm ứng của robot hoặc nói “Dẫn tôi đến phòng khám Ngoại” để robot dẫn đường.' },
      { heading: '3. Chờ gọi tên tại phòng khám', text: 'Màn hình điện tử trước mỗi cửa phòng khám hiển thị số thứ tự đang khám và thứ tự kế tiếp. Người bệnh vui lòng ngồi tại khu vực ghế chờ đã được bố trí.' }
    ],
    tips: 'Nên chuẩn bị trước thẻ BHYT và kết quả khám gần nhất để thủ tục tiếp nhận diễn ra nhanh chóng.'
  },
  {
    id: 'ART-02',
    code: 'HD-002',
    category: 'Vận hành Robot',
    title: 'Hướng dẫn nhận và kiểm tra túi thuốc tự động từ Robot MAR-01',
    updatedAt: 'Hôm qua · 15:40',
    status: 'PUBLISHED',
    readCount: 890,
    summary: 'Quy trình xác thực mã PIN / thẻ điều dưỡng để mở ngăn chứa an toàn khi robot giao thuốc đến trạm trực.',
    content: [
      { heading: '1. Robot thông báo đến nơi', text: 'Khi robot đến trạm điều dưỡng tại tầng chỉ định, robot sẽ phát âm thanh chào và hiển thị mã công việc giao nhận trên màn hình.' },
      { heading: '2. Xác thực quyền mở ngăn', text: 'Điều dưỡng trực dùng thẻ nhân viên quét qua đầu đọc NFC hoặc nhập mã PIN gồm 4 số được gửi qua ca trực để mở ngăn chứa.' },
      { heading: '3. Kiểm đếm và đóng ngăn an toàn', text: 'Đối chiếu danh mục thuốc trên màn hình robot với thuốc thực nhận, sau đó đóng cửa ngăn chứa và nhấn “Hoàn tất nhận thuốc”.' }
    ],
    tips: 'Trường hợp có nghi vấn sai lệch thuốc, vui lòng bấm “Báo cáo sai lệch” trên màn hình trước khi đóng ngăn.'
  },
  {
    id: 'ART-03',
    code: 'HD-003',
    category: 'Không gian & Chỉ dẫn',
    title: 'Sơ đồ luồng di chuyển và cụm thang máy dành cho người bệnh',
    updatedAt: '04/11/2026',
    status: 'PUBLISHED',
    readCount: 2150,
    summary: 'Phân luồng thang máy công cộng dành cho người nhà và thang máy hậu cần chuyên dụng cho xe cấp cứu, robot.',
    content: [
      { heading: '1. Cụm thang máy trung tâm (Thang A1, A2)', text: 'Dành riêng cho người bệnh và thân nhân di chuyển giữa các tầng từ Tầng 1 đến Tầng 4.' },
      { heading: '2. Thang máy hậu cần & Vận chuyển (Thang B1)', text: 'Ưu tiên vận chuyển giường bệnh cấp cứu, dụng cụ phẫu thuật và hành trình tự động của robot MAR-01.' },
      { heading: '3. Lối thoát hiểm khẩn cấp', text: 'Hệ thống cầu thang bộ thoát hiểm được bố trí ở hai đầu hành lang mỗi tầng, có đèn tín hiệu EXIT sáng 24/7.' }
    ],
    tips: 'Vui lòng không đứng chắn lối vào thang máy hậu cần khi robot MAR đang phát tín hiệu chuyển tầng.'
  },
  {
    id: 'ART-04',
    code: 'HD-004',
    category: 'Nội quy viện',
    title: 'Quy định giờ thăm bệnh nhân và phòng ngừa nhiễm khuẩn',
    updatedAt: '01/11/2026',
    status: 'PUBLISHED',
    readCount: 1670,
    summary: 'Khung giờ thăm nuôi tại các phòng nội trú và hướng dẫn khử khuẩn tay trước khi vào khu chăm sóc đặc biệt.',
    content: [
      { heading: '1. Khung giờ thăm bệnh quy định', text: 'Buổi trưa: 11h30 - 13h00 · Buổi chiều tối: 16h30 - 20h30 hàng ngày. Ngoài khung giờ trên, người nhà cần có thẻ nuôi bệnh.' },
      { heading: '2. Số lượng người thăm', text: 'Mỗi buồng bệnh tối đa 2 người thăm cùng một thời điểm để giữ không gian yên tĩnh và thông thoáng cho người bệnh phục hồi.' },
      { heading: '3. Vệ sinh và bảo vệ', text: 'Sát khuẩn tay nhanh bằng dung dịch cồn y tế đặt tại cửa buồng bệnh và đeo khẩu trang y tế suốt thời gian có mặt trong viện.' }
    ],
    tips: 'Trẻ em dưới 12 tuổi không nên vào khu vực buồng bệnh hồi sức tích cực để tránh nguy cơ nhiễm khuẩn chéo.'
  },
  {
    id: 'ART-05',
    code: 'HD-005',
    category: 'Khẩn cấp & An toàn',
    title: 'Hướng dẫn kích hoạt báo động khẩn cấp SOS và sơ cấp cứu té ngã',
    updatedAt: '28/10/2026',
    status: 'PUBLISHED',
    readCount: 3120,
    summary: 'Cách nhấn nút SOS trên thân robot hoặc tại các chốt hành lang khi phát hiện tình huống người bệnh gặp nguy hiểm.',
    content: [
      { heading: '1. Kích hoạt báo động khẩn cấp', text: 'Nhấn nút SOS đỏ trên ngực robot MAR-01 hoặc nút bấm khẩn cấp màu đỏ bố trí dọc hành lang và trong nhà vệ sinh.' },
      { heading: '2. Robot tự động phát tín hiệu', text: 'Ngay khi kích hoạt, robot sẽ dừng mọi hoạt động hiện tại, phát còi cảnh báo tại chỗ và truyền hình ảnh trực tiếp về Trung tâm điều hành.' },
      { heading: '3. Giữ nguyên vị trí người bệnh', text: 'Trừ khi có nguy cơ cháy nổ, tuyệt đối không di dời người bệnh bị ngã hoặc co giật. Hãy chờ nhân viên y tế đến sau 30-60 giây.' }
    ],
    tips: 'Nút SOS chỉ dùng trong tình huống khẩn cấp y tế. Mọi trường hợp bấm thử nghiệm vui lòng liên hệ phòng CNTT.'
  }
];

export default function HospitalInfoWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [tab, setTab] = useState(queryTab === 'floors' ? 'floors' : queryTab === 'articles' ? 'articles' : 'hospital');

  const [hospitals, setHospitals] = useState(DEFAULT_HOSPITALS);
  const [selectedHospital, setSelectedHospital] = useState(DEFAULT_HOSPITALS[0]);
  const [floors, setFloors] = useState(DEFAULT_FLOORS);
  const [selectedFloor, setSelectedFloor] = useState(DEFAULT_FLOORS[1]);
  const [articles] = useState(HARDCODED_ARTICLES);
  const [selectedArticle, setSelectedArticle] = useState(HARDCODED_ARTICLES[0]);
  const [search, setSearch] = useState('');
  const [articleCategory, setArticleCategory] = useState('Tất cả');
  const [toast, setToast] = useState('');

  const role = getSession()?.account?.role;

  useEffect(() => {
    if (queryTab && ['hospital', 'floors', 'articles'].includes(queryTab)) {
      setTab(queryTab);
    }
  }, [queryTab]);

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

    return () => controller.abort();
  }, []);

  const filteredFloors = floors.filter(f =>
    !search ||
    (f.floorName && f.floorName.toLowerCase().includes(search.toLowerCase())) ||
    (f.floorCode && f.floorCode.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredArticles = articles.filter(a => {
    const matchCat = articleCategory === 'Tất cả' || a.category === articleCategory;
    const matchSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.summary.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const categories = ['Tất cả', 'Tiếp đón & Hướng dẫn', 'Vận hành Robot', 'Không gian & Chỉ dẫn', 'Nội quy viện', 'Khẩn cấp & An toàn'];

  const metrics = [
    { label: 'Cơ sở bệnh viện', count: hospitals.length, tone: 'blue', icon: 'building' },
    { label: 'Số tầng hoạt động', count: floors.filter(f => f.active).length, tone: 'amber', icon: 'layers' },
    { label: 'Bài viết hướng dẫn', count: articles.length, tone: 'green', icon: 'book' },
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
            <p>Quản lý hồ sơ cơ sở y tế, sơ đồ tầng và các bài viết hướng dẫn người bệnh.</p>
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
                aria-pressed={tab === 'articles'}
                className={tab === 'articles' ? 'is-active' : ''}
                onClick={() => selectTab('articles')}
              >
                Bài viết hướng dẫn
                <span>{articles.length}</span>
              </button>
            </nav>
            <span className="lo-total">
              {tab === 'hospital' ? `${hospitals.length} cơ sở` : tab === 'floors' ? `${floors.length} tầng` : `${articles.length} bài viết`}
            </span>
          </div>

          {/* Filters Bar */}
          {tab !== 'hospital' && (
            <div className="lo-filters">
              <label className="lo-search">
                <Icon name="search" />
                <input
                  aria-label="Tìm kiếm"
                  placeholder={tab === 'floors' ? 'Tìm tên tầng, mã tầng (VD: Tầng 1, T1)...' : 'Tìm bài hướng dẫn, từ khóa, mã bài viết...'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </label>
              {tab === 'articles' && (
                <select
                  aria-label="Lọc chuyên mục bài viết"
                  value={articleCategory}
                  onChange={e => setArticleCategory(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
                  <button className="lo-button" onClick={() => selectTab('articles')}>
                    <Icon name="book" />Xem các bài viết hướng dẫn
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

        {/* TAB 3: ARTICLES (BÀI VIẾT HƯỚNG DẪN - HARDCODED UI) */}
        {tab === 'articles' && (
          <div className="lo-layout">
            <aside className="lo-job-list" aria-label="Danh sách bài viết">
              <header>
                <strong>{filteredArticles.length} bài hướng dẫn</strong>
                <span>Chỉ dẫn người bệnh</span>
              </header>
              <div className="lo-job-items">
                {filteredArticles.map(art => (
                  <button
                    key={art.id}
                    type="button"
                    className={`lo-job-item ${selectedArticle?.id === art.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedArticle(art)}
                  >
                    <div className="lo-job-item-top">
                      <span className="lo-badge lo-running"><i />{art.category}</span>
                      <span>{art.code}</span>
                    </div>
                    <strong>{art.title}</strong>
                    <span className="lo-job-target" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {art.summary}
                    </span>
                    <div className="lo-job-item-bottom">
                      <time>{art.updatedAt}</time>
                      <Icon name="arrow" />
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {selectedArticle && (
              <article className="lo-detail" aria-label="Nội dung bài viết">
                <header className="lo-detail-header">
                  <div>
                    <div className="lo-detail-kicker">
                      <span className="lo-badge lo-success"><i />Đã phát hành</span>
                      <span className="lo-badge lo-running"><i />{selectedArticle.category}</span>
                      <span>Mã bài viết: {selectedArticle.code}</span>
                    </div>
                    <h3>{selectedArticle.title}</h3>
                    <p><Icon name="book" />Cập nhật lúc {selectedArticle.updatedAt} · {selectedArticle.readCount} lượt xem</p>
                  </div>
                </header>

                <div className="lo-instruction" style={{ marginBottom: '20px' }}>
                  <strong>Tóm tắt nội dung</strong>
                  <p>{selectedArticle.summary}</p>
                </div>

                <div style={{ display: 'grid', gap: '18px', margin: '20px 0' }}>
                  {selectedArticle.content.map((sec, idx) => (
                    <section key={idx} style={{ background: '#f8fafc', border: '1px solid var(--lo-line)', borderRadius: '10px', padding: '16px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 650, color: 'var(--lo-ink)', margin: '0 0 6px' }}>
                        {sec.heading}
                      </h4>
                      <p style={{ fontSize: '13px', color: '#4a5d78', lineHeight: 1.7, margin: 0 }}>
                        {sec.text}
                      </p>
                    </section>
                  ))}
                </div>

                {selectedArticle.tips && (
                  <div className="lo-notice lo-notice-warning" style={{ marginTop: '16px' }}>
                    <Icon name="alert" />
                    <p><strong>Lưu ý cho người bệnh: </strong>{selectedArticle.tips}</p>
                  </div>
                )}

                <div className="lo-detail-actions" style={{ marginTop: '24px' }}>
                  <button className="lo-button lo-primary" onClick={() => {
                    setToast(`Đã sao chép liên kết bài viết "${selectedArticle.title}".`);
                    setTimeout(() => setToast(''), 3000);
                  }}>
                    Sao chép liên kết chia sẻ
                  </button>
                  <button className="lo-button" onClick={() => {
                    setToast(`Đã gửi thông báo cập nhật bài viết đến kiosk sảnh.`);
                    setTimeout(() => setToast(''), 3000);
                  }}>
                    Phát hành lên kiosk sảnh
                  </button>
                </div>
              </article>
            )}
          </div>
        )}
      </div>
    </section>
  );
}


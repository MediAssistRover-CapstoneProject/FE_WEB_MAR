import { API_BASE_URL } from '../../../features/api/client.js';
import { recordStatus, statusTone } from '../../../features/api/workspaceCatalog.js';
import { displayValue } from './RecordDetails.jsx';

export const enhancedSection = section => ['Missions', 'Live Operations', 'Facility Management', 'Public Catalog'].includes(section);
export const workspaceCopy = {
  Missions: ['Nhiệm vụ & yêu cầu', 'Tạo yêu cầu, xem trạng thái xử lý và mở từng mục để theo dõi. Các lần chạy thử ở Điều phối không xuất hiện trong danh sách này.'],
  'Live Operations': ['Theo dõi thực thi', 'Xem các công việc do máy chủ quản lý. Chọn một công việc để xem bước hiện tại và bật cập nhật trực tiếp.'],
  'Facility Management': ['Danh mục bệnh viện', 'Quản lý nội dung và địa điểm trên máy chủ. Các điểm đang lưu riêng trong trình duyệt ở Bản đồ không tự xuất hiện tại đây.'],
  'Public Catalog': ['Thông tin công khai', 'Xem nội dung mà người dùng có thể tra cứu. Dữ liệu lấy từ danh mục công khai của máy chủ; việc chỉnh sửa thực hiện tại Danh mục bệnh viện.'],
};
export const resourceHints = {
  requests: 'Yêu cầu dẫn đường, hỗ trợ và vận hành. Chọn loại yêu cầu để bắt đầu, sau đó theo dõi trạng thái trong danh sách.',
  deliveries: 'Theo dõi các yêu cầu giao nhận và thông tin bàn giao.',
  jobs: 'Một công việc là một lần thực thi quy trình. Mở chi tiết để xem các bước và kết quả.',
  hospitals: 'Hồ sơ giới thiệu bệnh viện. Tạo hoặc chỉnh sửa nội dung, kiểm tra trạng thái phát hành trước khi xem ở Thông tin công khai.',
  articles: 'Chọn bệnh viện để quản lý các bài hướng dẫn trực thuộc.',
  floors: 'Các tầng của bệnh viện, dùng để tổ chức bản đồ và phòng.',
  maps: 'Những phiên bản bản đồ đã lưu trên máy chủ, gắn với một tầng cụ thể.',
  zones: 'Các khu vực nằm trên bản đồ máy chủ và quy tắc sử dụng tương ứng.',
  rooms: 'Các phòng thuộc tầng, kèm loại phòng và thông tin khoa.',
  endpoints: 'Các điểm robot có thể đến trên bản đồ máy chủ. Chọn bản đồ trong bộ lọc để thu gọn danh sách.',
  groups: 'Gom các điểm đích phục vụ cùng mục đích. Chọn một nhóm để quản lý cấu hình.',
  members: 'Liên kết giữa nhóm và điểm đích, kèm thứ tự ưu tiên.',
};

export function WorkspaceIntro({ section, role }) {
  const copy = workspaceCopy[section];
  if (!copy) return null;
  return <header className="be-workspace-intro"><div><span className="be-eyebrow">{section === 'Public Catalog' ? 'TRA CỨU · CHỈ XEM' : 'KHÔNG GIAN QUẢN LÝ'}</span><h2>{copy[0]}</h2><p>{copy[1]}</p></div>
    {section === 'Public Catalog' && role === 'ADMIN' && <a className="be-link-button" href="/admin/facility">Quản lý nội dung →</a>}
    {section === 'Missions' && <a className="be-link-button" href="/admin/live-operations">Theo dõi công việc robot →</a>}
  </header>;
}

export function CatalogNavigation({ available, resource, onSelect, section }) {
  const groups = section === 'Facility Management' ? [
    ['Nội dung', ['hospitals', 'articles']],
    ['Không gian', ['floors', 'maps', 'zones', 'rooms']],
    ['Điểm phục vụ', ['endpoints', 'groups', 'members']],
  ] : [['Danh mục tra cứu', available.map(item => item.id)]];
  return <nav className="be-catalog-navigation" aria-label="Danh mục chức năng">{groups.map(([name, ids]) => <div key={name}><span>{name}</span><div>{available.filter(item => ids.includes(item.id)).map(item => <button type="button" key={item.id} aria-pressed={item.id === resource.id} className={item.id === resource.id ? 'selected' : ''} onClick={() => onSelect(item.id)}>{item.title}</button>)}</div></div>)}</nav>;
}

export function DataSource({ loading, error, loadedAt, total, parentReady }) {
  let host;
  try { host = new URL(API_BASE_URL || '/', window.location.origin).host; } catch { host = 'Máy chủ được cấu hình'; }
  const message = !parentReady ? 'Chọn danh mục cha để tải' : loading ? 'Đang tải từ máy chủ…' : error ? 'Không tải được dữ liệu' : loadedAt ? 'Đã nhận dữ liệu' : 'Chưa tải dữ liệu';
  return <div className={'be-source-strip' + (error ? ' has-error' : '')} role="status"><div><span className="be-source-dot" /><strong>{message}</strong><span>{host}</span></div><div>{total != null && !loading && !error && <strong>{total.toLocaleString('vi-VN')} kết quả</strong>}{loadedAt && !loading && !error && <span>Lần tải: {new Date(loadedAt).toLocaleTimeString('vi-VN')}</span>}<span>Danh sách tải theo yêu cầu</span></div></div>;
}

export function RecordSummary({ row, resource }) {
  const status = recordStatus(row);
  const code = row.requestCode || row.jobCode || row.endpointCode || row.mapCode || row.floorCode || row.roomCode || row.zoneCode || row.groupCode;
  const fields = [['Loại', row.requestType || row.serviceType || row.endpointType || row.roomType || row.zoneType || row.infoCategory], ['Phiên bản', row.versionNo], ['Ngôn ngữ', row.languageCode], ['Độ ưu tiên', row.priority], ['Cập nhật', row.updatedAt || row.requestedAt || row.createdAt]];
  return <section className="be-record-summary" aria-label="Tóm tắt bản ghi"><div>{status != null && <span className={'be-badge be-tone-' + statusTone(status)}>{displayValue(status)}</span>}{typeof row.publicVisible === 'boolean' && <span className="be-badge">{row.publicVisible ? 'Cho phép công khai' : 'Chỉ dùng nội bộ'}</span>}</div>{code && <p className="be-record-code">{code}</p>}{(row.description || row.requestNote) && <p>{row.description || row.requestNote}</p>}<dl>{fields.filter(([, value]) => value != null).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl>{typeof row.content === 'string' && <div className="be-readable-content">{row.content}</div>}{resource.section === 'Public Catalog' && <small>Bản ghi đang được trả về bởi danh mục công khai.</small>}</section>;
}

export function JobSteps({ detail }) {
  if (!Array.isArray(detail?.steps) || !detail.steps.length) return null;
  const steps = [...detail.steps].sort((a, b) => (a.executionSequenceNo ?? 0) - (b.executionSequenceNo ?? 0));
  return <section className="be-job-progress"><h4>Các bước thực thi · {steps.length}</h4><p>Trạng thái do máy chủ trả về; các lần thử lại được giữ trong lịch sử.</p><ol>{steps.map((step, index) => <li key={step.jobStepId || index}><span className="be-step-index">{index + 1}</span><div><strong>{step.stepCodeSnapshot || displayValue(step.stepTypeSnapshot)}</strong><small>{displayValue(step.stepTypeSnapshot)}{step.attemptNo != null ? ` · Lần thử ${step.attemptNo}` : ''}</small>{step.errorCode && <small className="be-step-error">{step.errorCode}</small>}</div><span className={'be-badge be-tone-' + statusTone(step.status)}>{displayValue(step.status)}</span></li>)}</ol></section>;
}

export function EmptyRecords({ resource, filtered, reset }) {
  return <div className="be-empty-state"><span aria-hidden="true">⌕</span><h3>{filtered ? 'Không có kết quả khớp bộ lọc' : 'Danh mục chưa có dữ liệu'}</h3><p>{filtered ? 'Thử bớt điều kiện hoặc đặt lại bộ lọc để xem tất cả.' : resource.section === 'Public Catalog' ? 'Chưa có nội dung đáp ứng điều kiện công khai. Kiểm tra trạng thái và quyền hiển thị trong Danh mục bệnh viện.' : 'Máy chủ trả về danh sách trống. Dữ liệu mới sẽ xuất hiện sau khi được tạo hoặc gửi xử lý.'}</p>{filtered && <button onClick={reset}>Xóa điều kiện lọc</button>}</div>;
}

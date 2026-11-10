import { useState } from 'react';
import { API_BASE_URL } from '../../../features/api/client.js';
import { dateQuery, detectionLabels, evidenceUrl } from '../../../features/monitoring/monitoringModel.js';
import { useMonitoringCatalogs, useMonitoringData } from '../../../features/monitoring/useMonitoringData.js';
import { CatalogSelect, DateFields, Empty, Facts, FeedError, FeedStatus, Filters, Frame, Notice, Pager, RefreshButton, revealDetail, SelectField, Technical, number, stamp } from './shared.jsx';

export default function HistoryPage() {
  const catalogs = useMonitoringCatalogs(['robots', 'maps', 'zones']);
  const [draft, setDraft] = useState({}), [applied, setApplied] = useState({}), [error, setError] = useState(''), [page, setPage] = useState(0), [selectedId, setSelectedId] = useState(null);
  const feed = useMonitoringData('GET /api/v1/admin/monitoring/detections', { ...applied, page, size: 20 });
  const detail = useMonitoringData('GET /api/v1/admin/monitoring/detections/{id}', {}, { path: { id: selectedId }, enabled: !!selectedId });
  const row = detail.value?.detectionEventId === selectedId ? detail.value : null;
  const rows = feed.value?.content || [], values = catalogs.values;
  const name = (type, key, value, field) => values[type]?.find(item => item[key] === value)?.[field] || (value ? `Mã ${value.slice(0, 8)}` : 'Chưa ghi nhận');
  const apply = () => { try { setApplied(dateQuery(draft)); setPage(0); setSelectedId(null); setError(''); } catch (cause) { setError(cause.message); } };
  const reset = () => { setDraft({}); setApplied({}); setPage(0); setSelectedId(null); setError(''); };
  return <Frame title="Lịch sử giám sát" description="Tra cứu sự kiện phát hiện và bằng chứng được robot ghi nhận." icon="time" actions={<RefreshButton feed={{ ...feed, refresh: () => { feed.refresh(); detail.refresh(); } }} />}>
    <Filters onApply={apply} onReset={reset} error={error}>
      <CatalogSelect label="Robot" value={draft.robotId} onChange={robotId => setDraft({ ...draft, robotId })} rows={values.robots} idKey="robotId" nameKey="robotName" /><SelectField label="Loại sự kiện" value={draft.type} onChange={type => setDraft({ ...draft, type })} options={Object.entries(detectionLabels)} />
      <DateFields value={draft} onChange={setDraft} />
    </Filters>
    {catalogs.warning && <Notice>{catalogs.warning}</Notice>}
    <FeedStatus feed={feed} /><FeedError feed={feed} />
    <div className="mw-split"><section className="mw-card mw-list" aria-label="Danh sách sự kiện giám sát">
      {!rows.length && !feed.loading && <Empty title="Chưa có ghi nhận phù hợp">Thử khoảng thời gian khác hoặc kiểm tra nguồn ghi nhận từ robot.</Empty>}
      <div className="mw-alert-list">{rows.map(item => <button type="button" key={item.detectionEventId} className={`mw-alert-row${selectedId === item.detectionEventId ? ' is-selected' : ''}`} aria-pressed={selectedId === item.detectionEventId} onClick={() => { setSelectedId(item.detectionEventId); revealDetail('mw-history-detail', true); }}><div className="mw-row-top"><time>{stamp(item.detectedAt)}</time></div><strong>{detectionLabels[item.eventType] || item.eventType}</strong><p>{name('robots', 'robotId', item.robotId, 'robotName')}{item.zoneId && ` · ${name('zones', 'zoneId', item.zoneId, 'zoneName')}`}</p><small>{item.evidenceRef ? 'Có tham chiếu bằng chứng' : 'Chưa có bằng chứng đính kèm'}</small></button>)}</div>
      <Pager data={feed.value} page={page} loading={feed.loading} onChange={value => { setPage(value); setSelectedId(null); }} />
    </section><section className="mw-card mw-detail" id="mw-history-detail" aria-label="Chi tiết ghi nhận giám sát">
      {!selectedId ? <Empty title="Chọn một ghi nhận">Thông tin thời gian, vị trí và bằng chứng sẽ xuất hiện tại đây.</Empty> : <><FeedError feed={detail} />{!row ? <p role="status">Đang tải chi tiết…</p> : <>
        <h3>{detectionLabels[row.eventType] || row.eventType}</h3><FeedStatus feed={detail} />
        <Facts items={[[ 'Thời điểm ghi nhận', stamp(row.detectedAt) ], [ 'Robot', name('robots', 'robotId', row.robotId, 'robotName') ], [ 'Khu vực', name('zones', 'zoneId', row.zoneId, 'zoneName') ], [ 'Bản đồ', name('maps', 'mapId', row.mapId, 'mapName') ], [ row.locationBasis === 'OBJECT' ? 'Vị trí đối tượng (m)' : 'Vị trí ghi nhận (m)', row.xM != null && row.yM != null ? `X: ${row.xM} · Y: ${row.yM}` : 'Chưa ghi nhận' ], [ 'Độ tin cậy', typeof row.confidenceScore === 'number' && row.confidenceScore >= 0 && row.confidenceScore <= 1 ? number(row.confidenceScore * 100, '%') : 'Chưa ghi nhận' ]]} />
        <Evidence key={row.detectionEventId} reference={row.evidenceRef} /><Technical value={row} />
      </>}</>}
    </section></div>
  </Frame>;
}
function Evidence({ reference }) {
  const [preview, setPreview] = useState(false), [failed, setFailed] = useState(false);
  const url = evidenceUrl(reference, API_BASE_URL), image = url && /\.(png|jpe?g|webp|gif)$/i.test(new URL(url).pathname);
  return <section className="mw-evidence"><h4>Bằng chứng</h4>{url ? <><a className="mw-link" href={url} target="_blank" rel="noopener noreferrer">Mở nguồn bằng chứng ↗</a>{image && !preview && <button type="button" className="mw-button" onClick={() => setPreview(true)}>Xem ảnh bằng chứng</button>}{preview && (failed ? <p role="status">Chưa tải được ảnh. Bạn có thể mở nguồn bằng chứng để kiểm tra quyền truy cập.</p> : <img src={url} alt="Ảnh bằng chứng của ghi nhận đã chọn" referrerPolicy="no-referrer" onError={() => setFailed(true)} />)}</> : <p>{reference ? 'Máy chủ lưu mã tham chiếu bằng chứng, chưa cung cấp liên kết xem trực tiếp.' : 'Ghi nhận này chưa có bằng chứng đính kèm.'}</p>}</section>;
}

import { fieldLabel, references } from '../../../features/api/workspaceCatalog.js';
import { displayValue } from './RecordDetails.jsx';
import SchemaFields from './SchemaFields.jsx';

export default function ListFilters({ resource, schema, value, applied, onChange, onApply, onReset, role }) {
  const selected = Object.entries(applied).filter(([, item]) => item !== '' && item != null);
  const simplify = ['Missions', 'Live Operations', 'Facility Management', 'Public Catalog'].includes(resource?.section);
  const basicNames = ['keyword', 'status', 'requestType', 'floorId', 'mapId', 'active'];
  const entries = Object.entries(schema.properties || {});
  const primary = entries.filter(([key]) => basicNames.includes(key));
  const secondary = entries.filter(([key]) => !basicNames.includes(key));
  const subset = items => ({ ...schema, properties: Object.fromEntries(items), required: (schema.required || []).filter(key => items.some(([name]) => name === key)) });
  return <details className="be-filter">
    <summary>
      <span className="be-filter-label"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8Z" strokeLinejoin="round" /></svg>{resource?.section === 'Public Catalog' ? 'Tìm kiếm và lọc' : 'Bộ lọc'}<span className="be-filter-count">{selected.length ? `${selected.length} đang áp dụng` : 'Không bắt buộc'}</span></span>
      <span className="be-filter-chevron" aria-hidden="true" />
    </summary>
    <form onSubmit={event => { event.preventDefault(); onApply(); }}>
      {resource?.filterHint && <p className="be-filter-hint">{resource.filterHint}</p>}
      {simplify && primary.length ? <><SchemaFields schema={subset(primary)} value={value} onChange={onChange} context={{ role, filter: true }} />{!!secondary.length && <details className="be-filter-advanced"><summary>Thêm điều kiện ({secondary.length})</summary><SchemaFields schema={subset(secondary)} value={value} onChange={onChange} context={{ role, filter: true }} /></details>}</> : <SchemaFields schema={schema} value={value} onChange={onChange} context={{ role, filter: true }} />}
      <div className="be-filter-footer"><span>Chọn điều kiện để thu gọn danh sách.</span><div className="be-actions"><button type="button" onClick={onReset}>Đặt lại</button><button type="submit" className="primary">Áp dụng bộ lọc</button></div></div>
    </form>
    {!!selected.length && <div className="be-filter-chips" aria-label="Điều kiện đang áp dụng">{selected.map(([key, item]) => <span key={key}>{fieldLabel(key)}: {references[key] ? 'Đã chọn' : displayValue(item)}</span>)}</div>}
  </details>;
}

import { useState } from 'react';
import { fieldLabel, settingDisplayValue } from '../../../features/api/workspaceCatalog.js';
import { vi } from '../../../i18n/vi.js';

export function displayValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value))) return new Date(value).toLocaleString('vi-VN');
  return vi(String(value));
}
const technicalField = key => /Id$|Hash$/.test(key) || ['id', 'settingKey', 'jobCode', 'requestCode', 'correlationKey', 'operationKey', 'idempotencyKey', 'rowVersion', 'protocolVersion', 'schemaVersion', 'graphVersion', 'ipAddress', 'userAgent'].includes(key);
const secretField = key => /^(accessToken|refreshToken|deviceSecret|password|temporaryPassword|currentPassword|newPassword|proof)$/i.test(key);
function Secret({ value }) {
  const [visible, setVisible] = useState(false);
  return <span><button type="button" onClick={() => setVisible(v => !v)}>{visible ? 'Ẩn' : 'Hiện giá trị'}</button>{visible && <code>{value}</code>}</span>;
}
export default function RecordDetails({ value, depth = 0 }) {
  if (value == null) return <p className="be-muted">Thao tác đã hoàn tất.</p>;
  if (typeof value !== 'object') return <p>{displayValue(value)}</p>;
  if (Array.isArray(value)) return value.length ? <div className="be-detail-array">{value.map((v, i) => <div key={i}><RecordDetails value={v} depth={depth + 1} /></div>)}</div> : <p className="be-muted">Chưa có dữ liệu.</p>;
  const entries = Object.entries(value);
  const regular = entries.filter(([key]) => !technicalField(key));
  const technical = entries.filter(([key]) => technicalField(key));
  const renderEntries = rows => <dl className="be-details">{rows.map(([key, item]) => <div key={key}>
    <dt>{fieldLabel(key)}</dt><dd>{key === 'settingValue' && settingDisplayValue(value) ? settingDisplayValue(value)
      : item && typeof item === 'object' ? <details open={depth < 1 && ['job', 'account', 'result'].includes(key)}><summary>{Array.isArray(item) ? `${item.length} mục` : 'Xem nội dung'}</summary><RecordDetails value={item} depth={depth + 1} /></details>
        : secretField(key) && item ? <Secret value={String(item)} /> : technicalField(key) ? (item == null || item === '' ? '—' : String(item)) : displayValue(item)}</dd>
  </div>)}</dl>;
  return <>{renderEntries(regular)}{!!technical.length && <details className="be-technical"><summary>Mã tra cứu và thông tin kỹ thuật</summary>{renderEntries(technical)}</details>}</>;
}

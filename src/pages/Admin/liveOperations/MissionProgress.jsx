import { memo } from 'react';
import { missionProgress } from '../../../features/operations/missionProgress.js';
import OperationsIcon from './OperationsIcon.jsx';

export default memo(function MissionProgress({ current, detail, catalogs, stale, connected, auto }) {
  const progress = missionProgress(detail, catalogs);
  const showNotice = current && progress && !progress.terminal && (!auto || stale || !connected);
  return <section className={`rm-progress rm-progress-${progress?.status.tone || 'neutral'}`} aria-label="Bước hiện tại trên bản đồ">
      <div className="rm-progress-heading" aria-live="polite" aria-atomic="true">
        <span className="rm-progress-icon"><OperationsIcon name={progress?.status.tone === 'success' ? 'check' : ['failed', 'attention'].includes(progress?.status.tone) ? 'alert' : 'activity'} /></span>
        <div className="rm-progress-main">
          <small>{progress?.index >= 0 && !progress.terminal ? `Bước ${progress.index + 1}` : 'Tiến trình'}</small>
          <strong className="rm-progress-title">{progress?.title || (current ? 'Đang tải bước hiện tại…' : 'Chưa có bước đang thực hiện')}</strong>
          {progress?.target && <span className="rm-progress-target">{progress.target}</span>}
        </div>
        {progress && <span className={`rm-step-status is-${progress.status.tone}`}>{progress.status.tone === 'success' ? '✓ ' : ''}{progress.status.label}</span>}
      </div>
    {showNotice && <small className="rm-progress-notice">{!auto ? 'Tự cập nhật đang tắt' : stale ? 'Thông tin gần nhất · Chưa có cập nhật mới' : 'Chưa có tín hiệu robot mới'}</small>}
  </section>;
});

import { useEffect, useRef } from 'react';

export default function DeleteWorkflowDialog({ target, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null), cancelRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current, previousFocus = dialog.ownerDocument.activeElement;
    dialog.showModal();
    cancelRef.current.focus();
    return () => {
      dialog.close();
      const next = previousFocus?.isConnected ? previousFocus : dialog.ownerDocument.querySelector('.wfd-page-header button');
      next?.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogRef} className="wfd-delete-dialog" aria-labelledby="wfd-delete-workflow-title" aria-describedby="wfd-delete-workflow-description" aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="wfd-delete-content">
      <div className="wfd-delete-heading"><div><span className="wfd-delete-eyebrow">QUẢN LÝ WORKFLOW</span><h2 id="wfd-delete-workflow-title">{target.serverId ? 'Xóa vĩnh viễn quy trình?' : 'Xóa bản thiết bị?'}</h2></div></div>
      <div className="wfd-delete-target"><span>{target.workflowCode}</span><strong>{target.workflowName}</strong></div>
      <p id="wfd-delete-workflow-description">{target.serverId ? 'Quy trình, lịch chạy và lịch sử nhiệm vụ liên quan sẽ bị xóa vĩnh viễn. Các bản thiết kế của quy trình này trên thiết bị cũng sẽ bị xóa. Không thể hoàn tác. Máy chủ sẽ từ chối nếu còn nhiệm vụ QUEUED, ACCEPTED hoặc RUNNING; hãy hủy hoặc hoàn tất chúng trước.' : 'Bản thiết kế trên thiết bị sẽ bị xóa. Không thể hoàn tác.'}</p>
      {error && <div role="alert" className="wfd-banner error">{error}</div>}
    </div>
    <footer><button type="button" ref={cancelRef} className="wfd-delete-cancel" disabled={busy} onClick={onCancel}>Hủy</button><button type="button" className="wfd-delete-confirm" disabled={busy} onClick={onConfirm}>{busy ? 'Đang xóa…' : target.serverId ? 'Xóa vĩnh viễn' : 'Xóa bản thiết bị'}</button></footer>
  </dialog>;
}

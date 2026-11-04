import { useEffect, useRef } from 'react';

export default function DeleteStepDialog({ node, connectionCount, onCancel, onConfirm }) {
  const dialogRef = useRef(null), cancelRef = useRef(null);
  const isTerminal = node.data.kind === 'terminal';
  const label = isTerminal ? 'điểm kết thúc' : 'bước';

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = dialog.ownerDocument.activeElement;
    dialog.showModal();
    cancelRef.current.focus();
    return () => {
      dialog.close();
      const target = previousFocus?.isConnected ? previousFocus : dialog.ownerDocument.querySelector('.wfd-canvas-toolbar button');
      target?.focus({ preventScroll: true });
    };
  }, []);

  function dismissBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onCancel();
  }

  return (
    <dialog ref={dialogRef} className="wfd-delete-dialog" aria-labelledby="wfd-delete-title" aria-describedby="wfd-delete-description wfd-delete-undo" onCancel={event => { event.preventDefault(); onCancel(); }} onClick={dismissBackdrop}>
      <div className="wfd-delete-content">
        <div className="wfd-delete-heading">
          <span className="wfd-delete-icon" aria-hidden="true">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg>
          </span>
          <div><span className="wfd-delete-eyebrow">CHỈNH SỬA WORKFLOW</span><h2 id="wfd-delete-title">Xóa {label} này?</h2></div>
          <button type="button" className="wfd-delete-close" aria-label="Đóng xác nhận xóa" onClick={onCancel}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        </div>
        <div className="wfd-delete-target"><span>{isTerminal ? 'Kết thúc' : node.data.stepType}</span><strong>{node.data.name || (isTerminal ? 'Kết thúc' : 'Bước chưa đặt tên')}</strong></div>
        <p id="wfd-delete-description">{connectionCount ? <><strong>{connectionCount} dây nối</strong> liên quan cũng sẽ bị xóa. Hãy nối lại luồng sau khi xóa {label}.</> : <>Chỉ {label} này sẽ bị xóa khỏi bản thiết kế.</>}</p>
        <p id="wfd-delete-undo" className="wfd-delete-undo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10h11a7 7 0 0 1 0 14M3 10l5-5M3 10l5 5" transform="translate(0 -3)" /></svg>Có thể khôi phục bằng nút Hoàn tác hoặc Ctrl+Z.</p>
      </div>
      <footer><button type="button" ref={cancelRef} className="wfd-delete-cancel" onClick={onCancel}>Hủy</button><button type="button" className="wfd-delete-confirm" onClick={onConfirm}>Xóa {label}</button></footer>
    </dialog>
  );
}

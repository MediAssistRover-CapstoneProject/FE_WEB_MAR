import { useEffect, useRef } from 'react';

export default function ApplyQrDeliveryDialog({ onCancel, onConfirm }) {
  const dialogRef = useRef(null), cancelRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current, previousFocus = dialog.ownerDocument.activeElement;
    dialog.showModal(); cancelRef.current.focus();
    return () => { dialog.close(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialogRef} className="wfd-delete-dialog" aria-labelledby="wfd-qr-template-title" aria-describedby="wfd-qr-template-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <div className="wfd-delete-content">
      <div className="wfd-delete-heading"><div><span className="wfd-delete-eyebrow">MẪU WORKFLOW</span><h2 id="wfd-qr-template-title">Áp dụng mẫu giao hàng QR?</h2></div></div>
      <p id="wfd-qr-template-description">Thay đồ thị hiện tại bằng 10 bước nhận hàng A → giao hàng B qua QR và nút yêu cầu đóng cửa. Chỉ vẽ luồng thành công; lỗi, hết giờ và phản hồi nút không hợp lệ tự dừng tại bước. Có thể hoàn tác.</p>
      <p>Mẫu được giữ ở bản nháp vì màn robot và luồng bàn giao BE/Pi còn cần tích hợp.</p>
    </div>
    <footer><button ref={cancelRef} type="button" className="wfd-delete-cancel" onClick={onCancel}>Hủy</button><button type="button" className="primary" onClick={onConfirm}>Áp dụng mẫu</button></footer>
  </dialog>;
}

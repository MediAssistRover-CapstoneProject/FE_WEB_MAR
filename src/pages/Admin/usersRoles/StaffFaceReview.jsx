import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../../../features/admin/adminApi.js';
import { staffError } from '../../../features/admin/staffManagement.js';
import { Dialog } from './StaffDialogs.jsx';

const STATUS_LABELS = {
  MISSING: ['Chưa có ảnh', 'muted'],
  PENDING: ['Chờ duyệt', 'amber'],
  READY: ['Đã duyệt', 'green'],
  INVALID: ['Ảnh không đạt', 'red'],
  REJECTED: ['Đã từ chối', 'red'],
};

const REVIEW_ERRORS = {
  NO_FACE: 'Không tìm thấy khuôn mặt trong ảnh.',
  MULTIPLE_FACES: 'Ảnh phải có đúng một khuôn mặt.',
  LOW_QUALITY: 'Ảnh chưa đủ rõ để xác thực khuôn mặt.',
  FACE_TOO_SMALL: 'Khuôn mặt trong ảnh quá nhỏ.',
  FACE_TOO_BLURRY: 'Khuôn mặt trong ảnh bị mờ.',
  INVALID_FACE_FEATURE: 'Không thể dùng ảnh này để xác thực khuôn mặt.',
  FACE_INVALID_ENROLLMENT_RESULT: 'Không thể dùng ảnh này để xác thực khuôn mặt.',
  FACE_AVATAR_TOO_LARGE: 'Ảnh dùng để xác thực khuôn mặt phải có dung lượng tối đa 2 MiB.',
  FACE_AI_BUSY: 'Dịch vụ xác thực đang bận. Vui lòng thử lại.',
  FACE_AI_UNAVAILABLE: 'Dịch vụ xác thực khuôn mặt tạm thời không khả dụng.',
  FACE_DISABLED: 'Tính năng xác thực khuôn mặt đang tắt.',
};

function sameAccount(status, accountId) {
  if (typeof status?.accountId !== 'string' || status.accountId.toLowerCase() !== accountId.toLowerCase()) {
    throw new Error('Không xác nhận được trạng thái ảnh của nhân viên đang chọn.');
  }
  return status;
}

export function StaffFaceReview({ accountId, name, staffCode, disabled }) {
  const [status, setStatus] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [imageState, setImageState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const pendingRequest = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    adminApi.getStaffFaceStatus(accountId, controller.signal).then(result => {
      if (!controller.signal.aborted) setStatus(sameAccount(result, accountId));
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(staffError(error));
    });
    return () => controller.abort();
  }, [accountId, revision]);

  useEffect(() => () => pendingRequest.current?.abort(), []);

  const refresh = (message = '') => {
    setStatus(null);
    setLoadError('');
    setNotice(message);
    setRevision(value => value + 1);
  };

  const imageUrl = /^https?:\/\//i.test(status?.avatarUrl || '') ? status.avatarUrl : null;
  const hasReviewableImage = Boolean(imageUrl && status?.avatarVersion && ['PENDING', 'INVALID', 'READY', 'REJECTED'].includes(status.status));
  const canApprove = hasReviewableImage && status.enabled === true && status.status !== 'READY';
  const canReject = hasReviewableImage && status.status !== 'REJECTED';
  const [label, tone] = STATUS_LABELS[status?.status] || ['Chưa xác định', 'muted'];

  const openReview = approve => {
    setReviewError('');
    setImageState('loading');
    setReview({ avatarVersion: status.avatarVersion, avatarUrl: imageUrl, approve });
  };

  const submitReview = async event => {
    event.preventDefault();
    if (disabled || pendingRequest.current || imageState !== 'ready' ||
        review.avatarVersion !== status?.avatarVersion) return;
    const controller = new AbortController();
    pendingRequest.current = controller;
    setBusy(true);
    setReviewError('');
    try {
      const result = await adminApi.reviewStaffFace(accountId, {
        avatarVersion: review.avatarVersion,
        approve: review.approve,
      }, controller.signal);
      if (controller.signal.aborted) return;
      const next = sameAccount(result, accountId);
      setStatus(next);
      setNotice('');
      setReview(null);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error.status === 409 || error.message?.includes('FACE_AVATAR_CHANGED')) {
        setReview(null);
        refresh('Ảnh đã thay đổi. Hãy kiểm tra ảnh mới trước khi duyệt.');
      } else if (error.status === 0 || error.status >= 500) {
        setReview(null);
        refresh('Chưa nhận được kết quả duyệt. Hãy kiểm tra lại trạng thái ảnh.');
      } else {
        setReviewError(REVIEW_ERRORS[error.message?.split(':')[0]] || staffError(error));
      }
    } finally {
      pendingRequest.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return <section className="um-face-review" aria-label="Duyệt ảnh đại diện">
    <header className="um-face-review-heading">
      <h4>Duyệt ảnh đại diện</h4>
      {status && <span className={`um-badge um-${tone}`} role="status">{label}</span>}
    </header>
    {notice && <p className="um-face-review-feedback" role="status">{notice}</p>}
    {loadError ? <p className="um-face-review-feedback um-face-review-error" role="alert">{loadError}</p>
      : !status ? <p role="status">Đang tải trạng thái ảnh…</p>
        : <div className="um-face-review-preview">
          {imageUrl && <img key={status.avatarVersion} src={imageUrl} alt="Ảnh đại diện đang xét duyệt" referrerPolicy="no-referrer" />}
          <div>
            <p>{imageUrl ? 'Ảnh dùng để xác thực khuôn mặt.' : 'Nhân viên chưa có ảnh để duyệt.'}</p>
            {!status.enabled && <p>Tính năng xác thực khuôn mặt đang tắt.</p>}
            {status.status === 'INVALID' && <p className="um-face-review-feedback um-face-review-error" role="alert">
              {REVIEW_ERRORS[status.reason] || 'Ảnh hiện tại chưa đạt yêu cầu xác thực.'}
            </p>}
          </div>
        </div>}
    {(status || loadError) && <div className="um-face-review-actions">
      {canApprove && <button type="button" className="um-primary" disabled={disabled || busy} onClick={() => openReview(true)}>Duyệt ảnh</button>}
      {canReject && <button type="button" disabled={disabled || busy} onClick={() => openReview(false)}>Từ chối ảnh</button>}
      <button type="button" className="um-text-button" disabled={busy} onClick={() => refresh()}>Tải lại ảnh</button>
    </div>}
    {review && <Dialog
      title={review.approve ? 'Duyệt ảnh đại diện' : 'Từ chối ảnh đại diện'}
      description={staffCode ? `${name} · ${staffCode}` : name}
      busy={busy}
      onClose={() => setReview(null)}
    >
      <form onSubmit={submitReview}>
        <div className="um-face-dialog-preview">
          {imageState !== 'error' && <img
            src={review.avatarUrl}
            alt={`Ảnh đại diện của ${name}`}
            referrerPolicy="no-referrer"
            onLoad={() => setImageState('ready')}
            onError={() => setImageState('error')}
          />}
          {imageState === 'loading' && <p role="status">Đang tải ảnh…</p>}
          {imageState === 'error' && <p role="alert">Không tải được ảnh để đối chiếu. Hãy đóng và tải lại ảnh.</p>}
          {imageState === 'ready' && <p>{review.approve
            ? 'Đối chiếu ảnh với nhân viên trước khi xác nhận duyệt.'
            : 'Sau khi từ chối, ảnh này sẽ không dùng được để xác thực khuôn mặt.'}</p>}
        </div>
        {reviewError && <p className="um-notice um-error" role="alert">{reviewError}</p>}
        <footer className="um-dialog-footer">
          <button type="button" disabled={busy} onClick={() => setReview(null)}>Quay lại</button>
          <button type="submit" className={review.approve ? 'um-primary' : 'um-danger'} disabled={disabled || busy || imageState !== 'ready'}>
            {busy ? 'Đang lưu…' : review.approve ? 'Xác nhận đúng người và duyệt' : 'Xác nhận từ chối'}
          </button>
        </footer>
      </form>
    </Dialog>}
  </section>;
}

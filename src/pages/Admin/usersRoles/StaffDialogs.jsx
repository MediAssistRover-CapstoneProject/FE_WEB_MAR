import { useEffect, useId, useRef, useState } from 'react';
import { callBackend } from '../../../features/api/backendApi.js';
import { prepareBody } from '../../../features/api/contract.js';
import { passwordError, staffActions, staffDisplayName, staffError, staffFingerprint } from '../../../features/admin/staffManagement.js';
import { STAFF_IMAGE_ACCEPT, staffImageError, uploadStaffImage } from '../../../features/admin/staffImages.js';

function Dialog({ title, description, busy, onClose, children }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="um-dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header className="um-dialog-header"><div><span className="um-eyebrow">QUẢN LÝ NHÂN VIÊN</span><h2 id={titleId}>{title}</h2><p>{description}</p></div><button type="button" aria-label="Đóng biểu mẫu" className="um-icon-button" disabled={busy} onClick={onClose}>×</button></header>
    {children}
  </dialog>;
}

function PasswordField({ label, value, onChange, reveal = true, wide = false }) {
  const [visible, setVisible] = useState(false);
  return <label className={`um-field${wide ? ' um-wide' : ''}`}><span>{label}</span><div className="um-password"><input aria-label={label} type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={72} value={value} onChange={e => onChange(e.target.value)} />{reveal && <button type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible(v => !v)}>{visible ? 'Ẩn' : 'Hiện'}</button>}</div></label>;
}

export function StaffForm({ member, actorId, onClose, onSaved, onRefresh }) {
  const [form, setForm] = useState(() => ({ username: '', temporaryPassword: '', fullName: member?.account?.fullName || '', email: member?.account?.email || '', phone: member?.account?.phone || '', staffCode: member?.staffCode || '', departmentCode: member?.departmentCode || '', jobTitle: member?.jobTitle || '', url: member?.url || '' }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [imageFile, setImageFile] = useState(null), [imageError, setImageError] = useState(''), [preview, setPreview] = useState(''), [uploading, setUploading] = useState(false);
  const imageInput = useRef(null);
  useEffect(() => {
    if (!imageFile) { setPreview(''); return; }
    const url = URL.createObjectURL(imageFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  const chooseImage = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const invalid = staffImageError(file);
    setImageError(invalid); setError(''); setImageFile(invalid ? null : file);
    if (invalid) event.target.value = '';
  };
  const cancelImage = () => { setImageFile(null); setImageError(''); if (imageInput.current) imageInput.current.value = ''; };
  const lock = useRef(false), set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const submit = async event => {
    event.preventDefault(); if (lock.current) return;
    setError('');
    try {
      if (imageError) throw Error(imageError);
      if (!member) { const invalid = passwordError(form.temporaryPassword); if (invalid) throw Error(invalid); }
      if (member && !staffActions(member, actorId).edit) throw Error('Nhân viên này không còn ở trạng thái cho phép chỉnh sửa.');
      const key = member ? 'PUT /api/v1/admin/staff/{id}' : 'POST /api/v1/admin/staff';
      const input = Object.fromEntries(['fullName', 'email', 'phone', 'staffCode', 'departmentCode', 'jobTitle', 'url'].map(name => [name, form[name].trim()]));
      if (!member) { input.username = form.username.trim(); input.temporaryPassword = form.temporaryPassword; }
      const body = prepareBody(key, input);
      lock.current = true; setBusy(true);
      if (member) {
        const current = await callBackend('GET /api/v1/admin/staff/{id}', { path: { id: member.staffProfileId } });
        if (staffFingerprint(current) !== staffFingerprint(member) || !staffActions(current, actorId).edit) { onRefresh(); throw Error('Hồ sơ đã thay đổi. Đóng biểu mẫu và mở lại trước khi lưu.'); }
      }
      if (imageFile) {
        setUploading(true);
        try {
          body.url = await uploadStaffImage(imageFile);
          set('url', body.url); setImageFile(null);
          if (imageInput.current) imageInput.current.value = '';
        } catch (cause) { throw Error(`Không tải được ảnh. ${staffError(cause)}`); }
        finally { setUploading(false); }
      }
      const saved = await callBackend(key, { path: member ? { id: member.staffProfileId } : {}, body });
      onSaved(saved, member ? 'Đã cập nhật hồ sơ nhân viên.' : 'Đã tạo tài khoản staff. Nhân viên phải đổi mật khẩu trong lần đăng nhập đầu tiên.', !member);
    } catch (cause) { setError(staffError(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Dialog title={member ? 'Chỉnh sửa hồ sơ nhân viên' : 'Tạo tài khoản nhân viên'} description={member ? `Điều chỉnh thông tin của ${staffDisplayName(member)}. Tên đăng nhập và vai trò được giữ nguyên.` : 'Tạo tài khoản Staff và hồ sơ nhân viên. Các trường có dấu * là bắt buộc.'} busy={busy} onClose={onClose}>
    <form onSubmit={submit}>
      <fieldset className="um-form" disabled={busy}>
        {!member && <><div className="um-form-section"><h3>Thông tin đăng nhập</h3><span className="um-badge um-blue">Vai trò · Staff</span></div>
          <label className="um-field um-wide"><span>Tên đăng nhập *</span><input required minLength={4} maxLength={100} pattern="[a-zA-Z0-9._-]+" autoComplete="off" value={form.username} onChange={e => set('username', e.target.value)} placeholder="Ví dụ: staff.khoa01" /><small>Từ 4 ký tự; dùng chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch nối.</small></label>
          <PasswordField label="Mật khẩu tạm thời *" value={form.temporaryPassword} onChange={value => set('temporaryPassword', value)} wide />
          <p className="um-form-note um-wide">Mật khẩu từ 8–72 ký tự. Nhân viên phải đổi mật khẩu khi đăng nhập lần đầu.</p></>}
        <div className="um-form-section"><h3>Hồ sơ nhân viên</h3>{member && <span className="um-readonly-name">@{member.account.username}</span>}</div>
        <label className="um-field"><span>Họ và tên *</span><input required maxLength={160} value={form.fullName} onChange={e => set('fullName', e.target.value)} autoComplete="off" /></label>
        <label className="um-field"><span>Mã nhân viên *</span><input required maxLength={64} value={form.staffCode} onChange={e => set('staffCode', e.target.value)} /></label>
        <label className="um-field"><span>Email *</span><input required type="email" maxLength={254} value={form.email} onChange={e => set('email', e.target.value)} autoComplete="off" /></label>
        <label className="um-field"><span>Số điện thoại</span><input type="tel" maxLength={32} value={form.phone} onChange={e => set('phone', e.target.value)} /></label>
        <label className="um-field"><span>Mã khoa</span><input maxLength={64} value={form.departmentCode} onChange={e => set('departmentCode', e.target.value)} placeholder="Ví dụ: KHOA01" /></label>
        <label className="um-field"><span>Chức danh</span><input maxLength={100} value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} /></label>
        <div className="um-image-picker um-wide">
          <div className="um-image-preview">{preview || form.url ? <img src={preview || form.url} alt="Ảnh nhân viên xem trước" /> : <span>Chưa có ảnh</span>}</div>
          <div className="um-image-controls">
            <label className="um-field"><span>Ảnh nhân viên</span><input ref={imageInput} aria-label="Ảnh nhân viên" type="file" accept={STAFF_IMAGE_ACCEPT} onChange={chooseImage} aria-describedby="staff-image-help" aria-invalid={!!imageError} /><small id="staff-image-help">Chọn ảnh JPG, PNG hoặc WebP từ máy, tối đa 20 MB. Ảnh sẽ được tải lên khi lưu.</small></label>
            {(imageFile || imageError) && <button type="button" className="um-text-button" onClick={cancelImage}>Bỏ ảnh đã chọn</button>}
            {imageError && <p className="um-image-error" role="alert">{imageError}</p>}
          </div>
        </div>
      </fieldset>
      {error && <p className="um-notice um-error" role="alert">{error}</p>}
      <footer className="um-dialog-footer"><button type="button" disabled={busy} onClick={onClose}>Đóng</button><button type="submit" className="um-primary" disabled={busy || !!imageError}>{uploading ? 'Đang tải ảnh…' : busy ? 'Đang lưu…' : member ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></footer>
    </form>
  </Dialog>;
}

const actionCopy = {
  lock: ['Khóa tài khoản', 'Nhân viên sẽ không thể đăng nhập và các phiên hiện tại bị thu hồi. Hồ sơ nhân viên vẫn được giữ để có thể mở khóa sau.'],
  unlock: ['Mở khóa tài khoản', 'Cho phép nhân viên đăng nhập lại. Nhân viên cần đăng nhập bằng mật khẩu hiện tại.'],
  reset: ['Đặt lại mật khẩu', 'Các phiên hiện tại bị thu hồi. Nhân viên phải đăng nhập bằng mật khẩu tạm thời mới và đổi mật khẩu. Trạng thái khóa tài khoản được giữ nguyên.'],
  deactivate: ['Ngừng hoạt động nhân viên', 'Nhân viên sẽ mất quyền đăng nhập và làm việc theo hồ sơ này. Lịch sử được giữ lại. Hãy kiểm tra việc bàn giao ca trực và công việc trước khi xác nhận.'],
};

export function StaffActionDialog({ action, actorId, onClose, onSaved, onRefresh }) {
  const { kind, member } = action, [title, description] = actionCopy[kind];
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmed, setConfirmed] = useState(false), [password, setPassword] = useState('');
  const lock = useRef(false);
  const submit = async event => {
    event.preventDefault(); if (lock.current) return;
    setError('');
    try {
      if (!confirmed) throw Error('Vui lòng xác nhận thao tác với tài khoản này.');
      if (kind === 'reset') { const invalid = passwordError(password); if (invalid) throw Error(invalid); }
      if (!staffActions(member, actorId)[kind]) throw Error('Thao tác không phù hợp với trạng thái nhân viên.');
      lock.current = true; setBusy(true);
      const current = await callBackend('GET /api/v1/admin/staff/{id}', { path: { id: member.staffProfileId } });
      if (staffFingerprint(current) !== staffFingerprint(member) || !staffActions(current, actorId)[kind]) { onRefresh(); throw Error('Tài khoản đã thay đổi. Đóng hộp thoại và kiểm tra lại trạng thái mới nhất.'); }
      let saved;
      if (kind === 'deactivate') {
        await callBackend('DELETE /api/v1/admin/staff/{id}', { path: { id: member.staffProfileId } });
        saved = { ...current, active: false, account: { ...current.account, status: 'INACTIVE' } };
      } else {
        const key = `POST /api/v1/admin/accounts/{accountId}/${kind === 'reset' ? 'reset-password' : kind}`;
        const account = await callBackend(key, { path: { accountId: current.account.accountId }, ...(kind === 'reset' ? { body: { newPassword: password } } : {}) });
        saved = { ...current, account: kind === 'reset' ? { ...current.account, mustChangePassword: true } : account };
      }
      onSaved(saved, `${title} thành công.`, false);
    } catch (cause) { setError(staffError(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Dialog title={title} description={description} busy={busy} onClose={onClose}>
    <div className="um-target"><strong>{staffDisplayName(member)}</strong><span>@{member.account.username} · {member.staffCode}</span></div>
    <form onSubmit={submit}><fieldset className="um-form" disabled={busy}>
      {kind === 'reset' && <PasswordField label="Mật khẩu tạm thời mới *" value={password} onChange={setPassword} wide />}
      <label className="um-confirm um-wide"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Tôi xác nhận {title.toLocaleLowerCase('vi')} cho @{member.account.username}.</label>
    </fieldset>{error && <p className="um-notice um-error" role="alert">{error}</p>}
      <footer className="um-dialog-footer"><button type="button" disabled={busy} onClick={onClose}>Quay lại</button><button type="submit" disabled={busy} className={kind === 'deactivate' || kind === 'lock' ? 'um-danger' : 'um-primary'}>{busy ? 'Đang xử lý…' : title}</button></footer>
    </form>
  </Dialog>;
}

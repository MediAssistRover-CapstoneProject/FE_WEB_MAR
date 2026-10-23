export function removalAction(workflow) {
  if (workflow.localOnly || workflow.status === 'DRAFT') return { kind: 'delete', label: 'Xóa bản nháp', explanation: workflow.localOnly ? 'Chỉ xóa bản trên thiết bị; bản máy chủ (nếu có) vẫn giữ nguyên.' : 'Xóa bản nháp trên máy chủ. BE sẽ từ chối nếu bản này đã được dùng trong lịch sử nhiệm vụ.' };
  if (workflow.status === 'PUBLISHED') return { kind: 'archive', label: 'Ngừng sử dụng', explanation: 'Quy trình sẽ không nhận nhiệm vụ mới và được đưa vào mục Đã ngừng. Lịch sử được giữ nguyên; thao tác này không hủy nhiệm vụ đang chạy.' };
  if (workflow.status === 'VALIDATED') return { kind: 'edit', label: 'Sửa để về bản nháp', explanation: 'BE chỉ cho xóa trạng thái bản nháp. Mở chỉnh sửa, lưu lại rồi xóa; nếu đã có lịch sử nhiệm vụ BE sẽ chặn chỉnh sửa.' };
  return { kind: 'none', label: 'Đã ngừng sử dụng', explanation: 'BE giữ bản này để bảo toàn lịch sử, không hỗ trợ xóa vĩnh viễn.' };
}

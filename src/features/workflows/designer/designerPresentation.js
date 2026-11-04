export const isCloseRequest = data => data?.stepType === 'INTERACT' && data.params?.action === 'CONFIRM' && ['REQUEST_CLOSE_SENDER', 'REQUEST_CLOSE_RECEIVER'].includes(data.params?.prompt_key);
export const branchesOnResult = data => data?.stepType === 'CHECK_CONDITION' || isCloseRequest(data);
export const branchResultField = data => isCloseRequest(data) ? 'confirmed' : 'value';

export function stepSuccessLabel(data) {
  if (data?.stepType === 'AUTHENTICATE' && data.params?.method === 'QR_CODE') return 'QR hợp lệ';
  if (isCloseRequest(data)) return 'Đã bấm nút';
  if (data?.stepType === 'MOVE') return 'Đã đến điểm';
  if (data?.stepType === 'CONTROL_HARDWARE') return 'Lệnh hoàn tất';
  return 'Thành công';
}

export function stepBehaviour(data) {
  if (data?.stepType === 'AUTHENTICATE' && data.params?.method === 'QR_CODE') return {
    hint: 'QR sai: quét lại trong thời hạn',
    text: 'Quét QR sai không hoàn tất bước và không đi sang nhánh Lỗi. Staff có thể quét lại khi QR còn hiệu lực. Chỉ xác thực hợp lệ mới đi tiếp để mở servo.',
    limitation: 'BE hiện chưa đếm số lần quét sai. Số lần thử trong phần thực thi không phải số lượt quét QR; không dùng để đặt giới hạn 3 lần.',
  };
  if (isCloseRequest(data)) return {
    hint: 'Chưa bấm: tiếp tục chờ',
    text: 'Chưa bấm nút thì giữ nguyên bước chờ. Phản hồi confirmed = true mới phát lệnh đóng servo. Bấm nút không phải bằng chứng cửa hoặc khóa đã đóng.',
    limitation: 'Nhánh “Phản hồi sai” chỉ bảo vệ khi một client gửi kết quả hoàn tất không có xác nhận hợp lệ; đây không phải trường hợp staff chưa bấm nút.',
  };
  return null;
}

export function workflowEdgeLabel(edge, document) {
  if (edge.source === 'start') return '';
  const source = document.nodes.find(node => node.id === edge.source)?.data;
  if (edge.data?.outcome === 'FAILURE') return 'Lỗi thực thi';
  if (edge.data?.outcome === 'TIMEOUT') return `Quá ${source?.timeoutSec ?? '?'} giây`;
  if (isCloseRequest(source)) return edge.data?.defaultTransition ? 'Phản hồi không hợp lệ' : 'Đã bấm · confirmed = true';
  if (!edge.data?.defaultTransition) return `Có điều kiện · ${edge.data?.priority}`;
  if (document.edges.some(other => other.source === edge.source && other.data?.outcome === edge.data?.outcome && !other.data.defaultTransition)) return 'Còn lại';
  return stepSuccessLabel(source) === 'Thành công' ? 'Tiếp tục' : stepSuccessLabel(source);
}

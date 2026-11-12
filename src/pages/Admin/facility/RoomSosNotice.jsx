import { isSosRoom, SOS_REPLACEMENT_HINT, SOS_RESTORE_HINT } from '../../../features/facility/roomDefaults.js';

export default function RoomSosNotice({ type, previousType, active = true, map = false }) {
  if (!isSosRoom(type) && !isSosRoom(previousType)) return null;
  return <p className="lo-muted" role="note" style={{ lineHeight: 1.8, overflowWrap: 'anywhere' }}>
    {isSosRoom(previousType) && (!isSosRoom(type) || !active) ? SOS_RESTORE_HINT : map ? SOS_REPLACEMENT_HINT.replace('Sau khi lưu', 'Sau khi áp dụng bản đồ') : SOS_REPLACEMENT_HINT}
    {isSosRoom(type) && !active && !isSosRoom(previousType) && ' Cần bật Phòng hoạt động trước khi lưu.'}
    {map && ' Thay đổi có hiệu lực khi bấm Áp dụng bản đồ; lưu nháp chưa đổi phòng tiếp nhận SOS.'}
    {isSosRoom(type) && ' Mã phòng tự gợi ý theo dạng SOS_01, SOS_02… khi chọn SOS; bạn có thể chỉnh sửa mã.'}
  </p>;
}

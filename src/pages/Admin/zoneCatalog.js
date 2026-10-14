// Map overlays are independent of the BE facility/business zone categories.
// Unsupported hardware/graph features are documented, not silently simulated.
export const ZONE_TYPES = [
  { id:'AREA', group:'Định danh', label:'Vùng có tên', color:'#60a5fa', help:'Gắn tên phòng hoặc khu vực; không thay đổi quy tắc di chuyển.' },
  { id:'EXCLUSION', group:'Điều hướng', label:'Vùng cấm', color:'#fb7185', help:'Cấm robot đi vào, kể cả khi thân robot chạm biên vùng.' },
  { id:'SPEED_LIMIT', group:'Điều hướng', label:'Giới hạn tốc độ', color:'#fbbf24', help:'Giảm tốc độ di chuyển. Mô phỏng áp dụng bảo thủ từ lúc tâm robot vào vùng; không tăng tốc độ tối đa của robot.' },
  { id:'PREFERRED_DIRECTION', group:'Điều hướng', label:'Hướng ưu tiên', color:'#a78bfa', help:'Chi phí âm ưu tiên hướng đi; chi phí 1 cấm hướng tương ứng. Có thể chặn chiều ngược để tạo luồng một chiều.' },
  { id:'ASSUMED_COST', group:'Điều hướng', label:'Vật cản quy ước', color:'#f97316', help:'Mô phỏng Assumed Cost ở chế độ vật cản (chi phí 1). Không xóa tường thật, không hỗ trợ giả định không gian trống hay chi phí trung gian.' },
  { id:'NO_REPLAN', group:'Điều hướng', label:'Không lập lại đường', color:'#e879f9', help:'Khi gặp vật cản thử nghiệm, giữ tuyến và chờ. Hết thời gian chờ thì dừng mô phỏng; chưa mô phỏng chu kỳ lập lại đường cục bộ/toàn cục của robot thật.' },
  { id:'SINGLE_ROBOT', group:'Điều phối giao thông', label:'Chỉ một robot', color:'#38bdf8', help:'Một robot giữ quyền sử dụng vùng. Robot khác chờ ngoài biên đến khi vùng được giải phóng. Kiểm tra bằng robot ảo thứ hai trong Điều phối.' },
  { id:'OCCUPANCY_MONITORING', group:'Giám sát', label:'Theo dõi robot trong vùng', color:'#34d399', help:'Ghi nhận robot vào/ra vùng và số robot hiện diện; không tự chặn giao thông, không đếm người.' },
  { id:'CUSTOM_COORDINATION', group:'Điều phối giao thông', label:'Phối hợp tùy chỉnh', color:'#38bdf8', unsupported:true, help:'Cần bộ điều phối đa robot để điều chỉnh hành vi vượt/chờ và phục hồi. Chưa áp dụng trong mô phỏng tuyến đơn.' },
  { id:'JUNCTION', group:'Điều phối giao thông', label:'Nút giao', color:'#38bdf8', unsupported:true, help:'Cần các làn đường của Graph Planner nối tại nút giao. Bản đồ hiện tìm đường trên lưới, chưa có đồ thị làn.' },
  { id:'LOOKAHEAD', group:'Điều hướng', label:'Khoảng quan sát phía trước', color:'#a78bfa', unsupported:true, help:'Cần dữ liệu vật cản và bộ điều hướng thời gian thực để cấu hình khoảng nhìn trước.' },
  { id:'NARROW_CORRIDOR', group:'An toàn & cảm biến', label:'Hành lang hẹp', color:'#f87171', unsupported:true, help:'Liên quan kích thước robot và vùng quét an toàn đã được kiểm định. Không tự thu nhỏ khoảng an toàn trong bản demo.' },
  { id:'NO_MOVING_RECOVERIES', group:'An toàn & cảm biến', label:'Không phục hồi bằng chuyển động', color:'#f87171', unsupported:true, help:'Cần các thủ tục phục hồi của robot thật; không đồng nghĩa vùng cấm hay không lập lại đường.' },
  { id:'CHANGING', group:'Bản đồ & định vị', label:'Khu vực thường thay đổi', color:'#94a3b8', unsupported:true, help:'Loại vật thể hay thay đổi khỏi mốc định vị; không phải quy tắc tìm đường. Cần bộ định vị LiDAR.' },
  { id:'ERASER', group:'Bản đồ & định vị', label:'Xóa dữ liệu trong vùng', color:'#94a3b8', unsupported:true, help:'Tạm bỏ dữ liệu bản đồ khi điều hướng/định vị. Không phải công cụ xóa vĩnh viễn; bản quét mẫu không hỗ trợ cập nhật cảm biến.' },
  { id:'REMAPPING', group:'Bản đồ & định vị', label:'Cập nhật bản quét', color:'#94a3b8', unsupported:true, help:'Cần cảm biến để cập nhật khu vực thay đổi chậm; không nên phủ mốc tường cố định.' },
  { id:'MAGNETIC_LINE', group:'An toàn & cảm biến', label:'Bám vạch từ', color:'#f87171', unsupported:true, help:'Cần cảm biến vạch từ và cấu hình tiếp cận trạm trên robot.' },
  { id:'TUNNELING', group:'An toàn & cảm biến', label:'Lọc sàn/trần 3D', color:'#f87171', unsupported:true, help:'Cần dữ liệu 3D và đánh giá an toàn; có thể bỏ sót vật cản không được LiDAR nhìn thấy.' },
  { id:'IGNORE_DYNAMIC_OBJECTS', group:'An toàn & cảm biến', label:'Bỏ qua ước lượng vật thể động', color:'#f87171', unsupported:true, help:'Không phù hợp nơi có người/xe di chuyển. Không bật chức năng này trong bản mô phỏng bệnh viện.' },
];
// Keep legacy types readable without offering advanced robot policies as new zones.
export const ZONE_SETUP_TYPES = ZONE_TYPES.filter(t => ['AREA', 'EXCLUSION', 'SPEED_LIMIT', 'ASSUMED_COST'].includes(t.id));
export const ZONE_ROBOT_POLICY = {
  AREA: 'Chỉ đặt tên khu vực, không thay đổi đường đi của robot.',
  EXCLUSION: 'Robot cần nhận vùng cấm và xác nhận áp dụng trước khi vận hành.',
  SPEED_LIMIT: 'Robot cần hỗ trợ giới hạn tốc độ theo vùng và xác nhận mức tốc độ đã nhận.',
  ASSUMED_COST: 'Robot cần nhận vật cản quy ước trong bản đồ điều hướng. Quy tắc này không thay thế cảm biến tránh vật cản.',
};
export const blockedZone = z => z.enabled !== false && ['EXCLUSION','ASSUMED_COST'].includes(z.type);

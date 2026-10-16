// Canonical zone contract shared by Map Studio and the backend Facility API.
export const ZONE_TYPES = [
  { id:'KEEP_OUT', label:'Khu vực cấm', color:'#fb7185', help:'Robot không được phép đi vào vùng này.' },
  { id:'SPEED', label:'Giới hạn tốc độ', color:'#fbbf24', help:'Robot phải giới hạn tốc độ khi di chuyển trong vùng này.' },
  { id:'NO_STOP', label:'Không được dừng', color:'#60a5fa', help:'Robot được phép đi qua nhưng không được dừng trong vùng này.' },
];

export const ZONE_SETUP_TYPES = ZONE_TYPES;
export const ZONE_ROBOT_POLICY = {
  KEEP_OUT: 'Robot không được lập tuyến đi vào khu vực này.',
  SPEED: 'Robot áp dụng giới hạn tốc độ đã cấu hình khi đi trong khu vực này.',
  NO_STOP: 'Robot được đi xuyên qua nhưng không được đặt điểm đích hoặc dừng trong khu vực này.',
};
export const blockedZone = zone => zone.enabled !== false && zone.type === 'KEEP_OUT';
export const noStopZone = zone => zone.enabled !== false && zone.type === 'NO_STOP';

export const DEFAULT_ROOM_DEPARTMENT_CODE = 'OUTPATIENT';

export const ROOM_TYPES = [
  ['SOS', 'Phòng tiếp nhận SOS'],
  ['GENERAL', 'Phòng chung'],
  ['EXAMINATION', 'Phòng khám'],
  ['WARD', 'Phòng bệnh'],
  ['PATIENT_ROOM', 'Phòng bệnh nhân'],
  ['PHARMACY', 'Kho dược'],
  ['LABORATORY', 'Phòng xét nghiệm'],
  ['WAITING_AREA', 'Khu chờ'],
  ['OTHER', 'Khác'],
];

export const isSosRoom = type => String(type || '').trim().toUpperCase() === 'SOS';
export const SOS_REPLACEMENT_HINT = 'Sau khi lưu, phòng này sẽ tiếp nhận SOS thay cho phòng hiện tại. Phòng cũ được khôi phục tên, loại và tên điểm đến trước khi trở thành SOS.';
export const SOS_RESTORE_HINT = 'Khi rời SOS hoặc tắt phòng, hệ thống khôi phục tên, loại phòng và tên điểm đến ban đầu. Muốn chọn loại khác, hãy chỉnh sửa tiếp sau khi khôi phục. Phòng tạo mới với loại SOS trở về Phòng chung.';

export function validateSosRoom(form, previous) {
  if (isSosRoom(form.roomType) && !form.active && !isSosRoom(previous?.roomType)) {
    throw Error('Bật Phòng hoạt động trước khi chọn phòng tiếp nhận SOS.');
  }
}

export function nextRoomCode(rooms = [], prefix = 'ROOM') {
  const used = new Set(rooms.map(room => String(room.roomCode || '').trim().toUpperCase()));
  for (let number = 1; ; number++) {
    const code = `${prefix}_${String(number).padStart(2, '0')}`;
    if (!used.has(code)) return code;
  }
}

// Identity excludes the edited room, including its draft shape in Map Studio.
// Saved codes remain user-editable and are checked again by the Room API.
export function roomTypePatch(form, roomType, rooms, identity = {}) {
  if (!isSosRoom(roomType) || !Array.isArray(rooms)) return { roomType };
  const others = rooms.filter(room => !(identity.roomId && room.roomId === identity.roomId)
    && !(identity.id && room.id === identity.id));
  const currentCode = String(form.roomCode || '').trim().toUpperCase();
  const currentIsFree = !others.some(room => String(room.roomCode || '').trim().toUpperCase() === currentCode);
  return { roomType: 'SOS', roomCode: /^SOS_\d+$/.test(currentCode) && currentIsFree
    ? currentCode : nextRoomCode(others, 'SOS') };
}

export const ROOM_DEPARTMENTS = [
  ['OUTPATIENT', 'Outpatient Department'],
  ['INPATIENT', 'Inpatient Department'],
  ['EMERGENCY', 'Emergency Department'],
  ['INTERNAL_MEDICINE', 'Internal Medicine'],
  ['SURGERY', 'Surgery'],
  ['PEDIATRICS', 'Pediatrics'],
  ['OBSTETRICS_GYNECOLOGY', 'Obstetrics and Gynecology'],
  ['CARDIOLOGY', 'Cardiology'],
  ['NEUROLOGY', 'Neurology'],
  ['ORTHOPEDICS', 'Orthopedics'],
  ['OPHTHALMOLOGY', 'Ophthalmology'],
  ['ENT', 'Ear, Nose and Throat'],
  ['DERMATOLOGY', 'Dermatology'],
  ['RADIOLOGY', 'Radiology'],
  ['LABORATORY', 'Laboratory'],
  ['PHARMACY', 'Pharmacy'],
  ['REHABILITATION', 'Rehabilitation'],
];

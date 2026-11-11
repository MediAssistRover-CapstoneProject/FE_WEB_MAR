export const DEFAULT_ROOM_DEPARTMENT_CODE = 'OUTPATIENT';

export const ROOM_TYPES = [
  ['GENERAL', 'Phòng chung'],
  ['EXAMINATION', 'Phòng khám'],
  ['WARD', 'Phòng bệnh'],
  ['PATIENT_ROOM', 'Phòng bệnh nhân'],
  ['PHARMACY', 'Kho dược'],
  ['LABORATORY', 'Phòng xét nghiệm'],
  ['WAITING_AREA', 'Khu chờ'],
  ['SOS', 'Phòng trực SOS'],
  ['OTHER', 'Khác'],
];

export function nextRoomCode(rooms = []) {
  const used = new Set(rooms.map(room => String(room.roomCode || '').trim().toUpperCase()));
  for (let number = 1; ; number++) {
    const code = `ROOM_${String(number).padStart(2, '0')}`;
    if (!used.has(code)) return code;
  }
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

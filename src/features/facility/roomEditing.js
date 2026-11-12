import { DEFAULT_ROOM_DEPARTMENT_CODE, isSosRoom, nextRoomCode, validateSosRoom } from './roomDefaults.js';

export function newRoomForm(rooms, floorId = '') {
  return roomForm({ floorId, roomCode: nextRoomCode(rooms), roomType: 'GENERAL',
    departmentCode: DEFAULT_ROOM_DEPARTMENT_CODE, active: true, publicVisible: false });
}

export function roomForm(room) {
  return {
    floorId: room.floorId,
    defaultEndpointGroupId: room.defaultEndpointGroupId || '',
    roomCode: room.roomCode || '',
    roomName: room.roomName || '',
    roomType: room.roomType || '',
    departmentCode: room.departmentCode || '',
    description: room.description || '',
    active: !!room.active,
    publicVisible: !!room.publicVisible,
  };
}

export function roomPayload(form, roomId, rooms, groups, maps) {
  if (!form.floorId) throw Error('Vui lòng chọn tầng cho phòng.');
  validateSosRoom(form, rooms.find(room => room.roomId === roomId));
  const roomName = form.roomName.trim(), roomCode = form.roomCode.trim();
  if (!roomName || roomName.length > 160) throw Error('Tên phòng bắt buộc, tối đa 160 ký tự.');
  if (!roomCode || roomCode.length > 64) throw Error('Mã phòng bắt buộc, tối đa 64 ký tự.');
  if (!form.roomType.trim() || form.roomType.length > 64) throw Error('Vui lòng chọn loại phòng hợp lệ.');
  if (rooms.some(room => room.roomId !== roomId && room.roomCode?.trim().toLowerCase() === roomCode.toLowerCase())) {
    throw Error('Mã phòng đã được sử dụng, kể cả ở tầng khác hoặc phòng đã ngừng hoạt động.');
  }
  if (form.defaultEndpointGroupId) {
    const group = groups.find(group => group.endpointGroupId === form.defaultEndpointGroupId);
    if (!group || !maps.some(map => map.mapId === group.mapId && map.floorId === form.floorId)) {
      throw Error('Nhóm điểm mặc định phải thuộc bản đồ cùng tầng với phòng.');
    }
  }
  return { ...form, roomName, roomCode, roomType: isSosRoom(form.roomType) ? 'SOS' : form.roomType.trim(),
    departmentCode: form.departmentCode.trim() || null, description: form.description.trim() || null,
    defaultEndpointGroupId: form.defaultEndpointGroupId || null };
}

// Explicitly retain navigation fields when only changing a room association.
export function endpointRoomPayload(point, roomId) {
  return { mapId: point.mapId, zoneId: point.zoneId || null, roomId: roomId || null,
    endpointCode: point.endpointCode, endpointName: point.endpointName, endpointType: point.endpointType,
    xM: point.xM, yM: point.yM, yawRad: point.yawRad,
    active: point.active, accessible: point.accessible, publicVisible: point.publicVisible,
    description: point.description || '' };
}

export const roomTypeLabel = (value, types) => types.find(([code]) => code === value)?.[1] || value || 'Chưa phân loại';

// Compare room identity rather than drawing identity: redrawing the same room
// or moving its shape is not a request to retire it.
export function removedPublishedRooms(published, draft, endpoints = []) {
  const roomId = feature => feature.roomId || endpoints.find(point => point.endpointId === feature.endpointId)?.roomId;
  const retained = new Set((draft?.features || []).filter(feature => feature.type === 'ROOM').map(roomId).filter(Boolean));
  const removed = new Map();
  for (const feature of published?.features || []) {
    const id = feature.type === 'ROOM' && roomId(feature);
    if (id && !retained.has(id)) removed.set(id, feature);
  }
  return [...removed.values()];
}

// Merge catalog edits into unchanged published fields without discarding an
// administrator's newer, unpublished edits in Map Studio.
export function hydrateRoomFeatures(document, endpoints, rooms, published) {
  return { ...document, features: document.features.map(feature => {
    if (feature.type !== 'ROOM') return feature;
    const endpoint = endpoints.find(point => point.endpointId === feature.endpointId);
    const room = rooms.find(room => room.roomId === feature.roomId || room.roomId === endpoint?.roomId);
    if (!room) return feature;
    const base = published?.features.find(item => item.id === feature.id);
    const next = { ...feature, roomId: room.roomId };
    const fields = { roomCode: room.roomCode, roomName: room.roomName, roomType: room.roomType,
      departmentCode: room.departmentCode ?? '', roomDescription: room.description ?? '', roomPublicVisible: room.publicVisible };
    for (const [key, value] of Object.entries(fields)) {
      if (feature[key] == null || (base && feature[key] === base[key])) next[key] = value;
    }
    if (!feature.label || (base && feature.label === base.label && base.label === (base.roomName || base.label))) next.label = next.roomName;
    if (base && feature.endpointId === base.endpointId && endpoint?.roomId !== room.roomId) {
      next.endpointId = endpoints.find(point => point.roomId === room.roomId && point.active && point.accessible)?.endpointId || null;
    }
    return next;
  }) };
}

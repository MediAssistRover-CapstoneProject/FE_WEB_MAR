// A room may be linked to several map versions. Any active linked map keeps it
// operational; changing maps must not rewrite its manual enable/disable setting.
export function roomIsOperational(room, maps, endpoints, floors = []) {
  if (!room?.active) return false;
  if (!maps || !endpoints) return room.operational ?? room.active;
  if (floors.some(floor => floor.floorId === room.floorId && !floor.active)) return false;
  const activeMaps = new Set(maps.filter(map => map.status === 'ACTIVE' && map.floorId === room.floorId).map(map => map.mapId));
  return endpoints.some(point => point.roomId === room.roomId && point.active && activeMaps.has(point.mapId));
}

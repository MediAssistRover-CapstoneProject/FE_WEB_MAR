import { apiRequest } from '../api/client.js';
import { roomIsOperational } from './roomAvailability.js';

// Operational pickers share this reader. Administrative room editing explicitly
// requests includeDeleted=true and keeps its full catalog for maintenance.
export function createOperationalRoomReader(request = apiRequest) {
  const all = async (resource, signal) => {
    const rows = [];
    for (let page = 0; page < 1000; page++) {
      const value = await request(`/api/v1/${resource}?page=${page}&size=100`, { signal });
      if (Array.isArray(value)) return value;
      if (!Array.isArray(value?.content)) throw Error('Danh mục phòng/bản đồ không đúng định dạng.');
      rows.push(...value.content);
      if (value.last || page + 1 >= value.totalPages || value.content.length < 100) return rows;
    }
    throw Error('Danh mục phòng/bản đồ vượt quá giới hạn tải.');
  };
  return async ({ signal, mapId } = {}) => {
    const rooms = await all('rooms', signal);
    if (!mapId && rooms.every(room => typeof room.operational === 'boolean')) return rooms.filter(room => room.active && room.operational);
    if (!rooms.length) return [];
    const [maps, endpoints, floors] = await Promise.all(['maps', 'endpoints', 'floors'].map(resource => all(resource, signal)));
    const scope = mapId ? maps.filter(map => map.mapId === mapId) : maps;
    return rooms.filter(room => roomIsOperational(room, scope, endpoints, floors));
  };
}

export const readOperationalRooms = createOperationalRoomReader();
export async function operationalRoomPage({ page = 0, size = 20, mapId } = {}, options = {}) {
  const rows = await readOperationalRooms({ ...options, mapId });
  const number = Math.max(0, Number(page) || 0), count = Math.max(1, Number(size) || 20);
  const content = rows.slice(number * count, (number + 1) * count);
  return { content, number, size: count, totalElements: rows.length, totalPages: Math.ceil(rows.length / count), first: number === 0, last: (number + 1) * count >= rows.length, empty: !content.length };
}

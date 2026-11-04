import { endpointPayload } from './facilityContract.js';

// The image bounds alone cannot distinguish free space from a wall or unknown cell.
export async function saveValidatedEndpoint(api, endpoint, map, zones, rooms) {
  const body = endpointPayload(endpoint, map, zones, rooms);
  const verified = await api.validateNavigationPoint(body.mapId, { xM: body.xM, yM: body.yM });
  if (verified?.mapId !== body.mapId || verified.knownFree !== true) {
    throw Error('Máy chủ chưa xác nhận điểm nằm trên ô trống của đúng bản đồ.');
  }
  return endpoint.endpointId
    ? api.updateEndpoint(endpoint.endpointId, body)
    : api.createEndpoint(body);
}

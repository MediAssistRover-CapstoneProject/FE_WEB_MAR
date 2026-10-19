// Springdoc uses short nested-record names and currently conflates Create,
// Update and Confirm. These per-operation schemas follow BE main bd5af7a's
// StaffRequests, ShiftRequests, DeliveryRequests, AuthVerificationRequests
// and SystemSettingRequests. Never fix this collision by changing the BE.
const str = (maxLength, extra = {}) => ({ type: 'string', ...(maxLength ? { maxLength } : {}), ...extra });
const uuid = { type: 'string', format: 'uuid' };
const date = { type: 'string', format: 'date-time' };
const bool = { type: 'boolean' };
const integer = (minimum, maximum) => ({ type: 'integer', minimum, ...(maximum === undefined ? {} : { maximum }) });
const enumeration = (...values) => ({ type: 'string', enum: values });
const object = (properties, required = []) => ({ type: 'object', properties, required });
const json = { type: 'object', additionalProperties: true };
const staff = {
  fullName: str(160), email: str(254, { format: 'email' }), phone: str(32, { pattern: '^\\+?[0-9][0-9 .-]{7,30}$' }),
  staffCode: str(64), departmentCode: str(64), jobTitle: str(100), contactExtension: str(20),
};
const slot = object({ sequenceNo: integer(1), startsAt: date, endsAt: date, status: enumeration('AVAILABLE', 'BLOCKED', 'CLOSED'), note: str(4000) }, ['sequenceNo', 'startsAt', 'endsAt', 'status']);
const shift = { staffProfileId: uuid, roomId: uuid, shiftName: str(100), startsAt: date, endsAt: date, note: str(4000), slots: { type: 'array', items: slot } };
const shiftRequired = ['staffProfileId', 'roomId', 'shiftName', 'startsAt', 'endsAt', 'slots'];
const item = object({ itemCode: str(80), itemName: str(160), itemCategory: str(64), quantity: integer(1), unit: str(32), sensitive: bool, handlingInstruction: str(4000), itemNote: str(4000) }, ['itemCode', 'itemName', 'itemCategory', 'quantity', 'unit']);
const confirm = object({ verificationId: uuid, jobStepId: uuid, items: { type: 'array', minItems: 1, items: object({ itemCode: str(80), quantity: integer(1) }, ['itemCode', 'quantity']) }, compartmentClosed: { ...bool, const: true }, compartmentLocked: { ...bool, const: true }, note: str(1000) }, ['verificationId', 'jobStepId', 'items', 'compartmentClosed', 'compartmentLocked']);
const setting = { settingValue: { ...json, minProperties: 1 }, dataType: enumeration('STRING', 'NUMBER', 'BOOLEAN', 'OBJECT', 'ARRAY'), category: str(64), description: str(4000), publicSetting: bool };

export const requestOverrides = {
  'POST /api/v1/mapping-jobs': object({ workflowId: uuid, robotId: uuid, floorId: uuid, mapName: str(160) }, ['workflowId', 'robotId', 'floorId', 'mapName']),
  'POST /api/v1/admin/staff': object({ username: str(100, { minLength: 4, pattern: '^[a-zA-Z0-9._-]+$' }), temporaryPassword: str(72, { minLength: 8, format: 'password' }), ...staff }, ['username', 'temporaryPassword', 'fullName', 'email', 'staffCode']),
  'PUT /api/v1/admin/staff/{id}': object(staff, ['fullName', 'email', 'staffCode']),
  'POST /api/v1/admin/shifts': object({ ...shift, shiftCode: str(64, { pattern: '[A-Z0-9][A-Z0-9_-]*' }) }, [...shiftRequired, 'shiftCode']),
  'PUT /api/v1/admin/shifts/{shiftId}': object(shift, shiftRequired),
  'POST /api/v1/admin/system-settings': object({ settingKey: str(100, { pattern: '[a-z0-9]+(?:[._-][a-z0-9]+)*' }), ...setting }, ['settingKey', 'settingValue', 'dataType', 'category']),
  'PUT /api/v1/admin/system-settings/{id}': object(setting, ['settingValue', 'dataType', 'category']),
  'POST /api/v1/delivery-requests': object({
    mapId: uuid, pickupRoomId: uuid, deliveryRoomId: uuid, pickupEndpointId: uuid, deliveryEndpointId: uuid, deliveryGroupId: uuid,
    targetMode: enumeration('ENDPOINT', 'ENDPOINT_GROUP'), recipientName: str(160), recipientContact: str(100), requiresConfirmation: { ...bool, const: true },
    temperatureRequirement: str(4000), deliveryDeadline: date, deliveryNote: str(4000), items: { type: 'array', minItems: 1, items: item }, priority: integer(0, 100), note: str(4000), data: json,
  }, ['mapId', 'pickupEndpointId', 'targetMode', 'recipientName', 'requiresConfirmation', 'items']),
  'POST /api/v1/delivery-requests/{id}/confirm-pickup': confirm,
  'POST /api/v1/delivery-requests/{id}/confirm-delivery': confirm,
  'POST /api/v1/jobs/{jobId}/auth-verifications': object({ authJobStepId: uuid, method: enumeration('STAFF_CONFIRMATION'), purpose: enumeration('DELIVERY_SENDER', 'DELIVERY_RECEIVER'), validForSeconds: integer(30, 900) }, ['authJobStepId', 'method', 'purpose', 'validForSeconds']),
  'POST /api/v1/job-steps/{id}/responses': object({ responseType: enumeration('PAYLOAD_CONFIRMED', 'DOOR_CLOSED', 'LOCK_CHECKED', 'UI_DISPLAYED', 'INTERACTION_CONFIRMED'), data: json, note: str(2000) }, ['responseType', 'data']),
};

import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_OVERLAY_TOPIC, decodeRobotAiOverlay, drawRobotAiOverlay } from '../src/features/media/robotAiOverlay.js';

const session = { robotId: 'robot-1', sessionId: 'session-1' };
const participant = { identity: 'robot-robot-1' };
const detection = () => ({ bbox: [.1, .2, .3, .5], confidence: .92, state: 'PERSON', track_id: 7, distance_m: 1.8 });
const packet = (patch = {}) => ({ v: 1, media_session_id: session.sessionId, seq: 1, width: 320, height: 240, status: 'OK', detections: [detection()], ...patch });
const encode = value => new TextEncoder().encode(JSON.stringify(value));
const decode = (value, sequence = 0) => decodeRobotAiOverlay(encode(value), participant, AI_OVERLAY_TOPIC, session, sequence, 1000);

test('overlay accepts authenticated session data and uses viewer receipt time', () => {
  const value = decode(packet());
  assert.equal(value.receivedAt, 1000);
  assert.deepEqual(value.detections, [detection()]);
  assert.equal(decode(packet(), 1), null, 'a replay cannot refresh the overlay lifetime');
  assert.equal(decode(packet({ seq: 0 })), null);
  assert.equal(decode(packet({ seq: 2 }), 1).seq, 2);
});

test('another robot, participant, session or topic cannot draw on this video', () => {
  const bytes = encode(packet());
  assert.equal(decodeRobotAiOverlay(bytes, { identity: 'staff-robot-1' }, AI_OVERLAY_TOPIC, session), null);
  assert.equal(decodeRobotAiOverlay(bytes, { identity: 'robot-other' }, AI_OVERLAY_TOPIC, session), null);
  assert.equal(decodeRobotAiOverlay(bytes, participant, 'another-topic', session), null);
  assert.equal(decode(packet({ media_session_id: 'another-session' })), null);
  assert.equal(decodeRobotAiOverlay(bytes, participant, AI_OVERLAY_TOPIC, null), null);
});

test('malformed and oversized packets and invalid detections are ignored', () => {
  for (const value of [null, {}, packet({ width: 0 }), packet({ height: 641 }), packet({ seq: 1.2 }),
    packet({ status: 'OTHER' }), packet({ detections: Array(9).fill(detection()) }),
    ...[{ bbox: [.9, 0, .3, .2] }, { bbox: [0, 0, 0, .2] }, { confidence: '0.9' }, { confidence: 2 },
      { state: '<script>' }, { track_id: -1 }, { distance_m: 0 }].map(patch => packet({ detections: [{ ...detection(), ...patch }] }))]) {
    assert.equal(decode(value), null);
  }
  for (const bytes of [new Uint8Array(1201), new Uint8Array([0xff]), new TextEncoder().encode('{bad'), 'not bytes'])
    assert.equal(decodeRobotAiOverlay(bytes, participant, AI_OVERLAY_TOPIC, session), null);
});

function drawing() {
  const boxes = [], texts = [];
  const context = { setTransform() {}, clearRect() { boxes.length = 0; texts.length = 0; },
    strokeRect(...box) { boxes.push({ box, color: this.strokeStyle }); }, measureText: text => ({ width: text.length * 6 }),
    fillRect() {}, fillText(text) { texts.push(text); } };
  return { canvas: { width: 0, height: 0, getContext: () => context }, boxes, texts };
}
const video = { clientWidth: 640, clientHeight: 480, videoWidth: 1280, videoHeight: 720 };
const wideOverlay = () => decode(packet({ width: 320, height: 180 }));

test('boxes align with object-fit contain and high DPI', () => {
  const f = drawing();
  drawRobotAiOverlay(f.canvas, video, wideOverlay(), { live: true, now: 1000, pixelRatio: 3 });
  assert.deepEqual(f.boxes[0], { box: [64, 132, 192, 180], color: '#35d98b' });
  assert.equal(f.canvas.width, 1280); assert.equal(f.canvas.height, 960);
  assert.match(f.texts[0], /Người #7.*92%.*1.8 m/);
});

test('stale, paused, degraded, mismatched or stopped video clears boxes independently of video', () => {
  for (const [overlay, options, expected] of [
    [wideOverlay(), { live: true, now: 4001 }, /chờ kết quả nhận diện mới/],
    [wideOverlay(), { live: false, now: 1000 }, /Chờ camera/],
    [wideOverlay(), { live: true, enabled: false, now: 1000 }, /Đã tắt/],
    [{ ...wideOverlay(), status: 'PAUSED' }, { live: true, now: 1000 }, /tạm nhường/],
    [{ ...wideOverlay(), status: 'DEGRADED' }, { live: true, now: 1000 }, /Chưa nhận được/],
    [decode(packet()), { live: true, now: 1000 }, /chưa khớp/],
  ]) {
    const f = drawing();
    drawRobotAiOverlay(f.canvas, video, wideOverlay(), { live: true, now: 1000 });
    assert.equal(f.boxes.length, 1);
    assert.match(drawRobotAiOverlay(f.canvas, video, overlay, options), expected);
    assert.equal(f.boxes.length, 0);
  }
});

test('fall labels indicate suspicion without presenting detection confidence as fall probability', () => {
  for (const state of ['SUSPECTED_FALL', 'PERSON_ON_FLOOR']) {
    const f = drawing();
    const overlay = decode(packet({ width: 320, height: 180, detections: [{ ...detection(), state }] }));
    drawRobotAiOverlay(f.canvas, video, overlay, { live: true, now: 1000 });
    assert.equal(f.boxes[0].color, '#ff6060');
    assert.match(f.texts[0], /Nghi/); assert.doesNotMatch(f.texts[0], /%/);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { staffImageError } from '../src/features/admin/staffImages.js';

test('staff images follow the BE image types, filename extensions and 20 MB limit', () => {
  for (const [name, type] of [['a.JPG', 'image/jpeg'], ['a.jpeg', 'image/jpeg'], ['a.png', 'image/png'], ['a.webp', 'image/webp']]) {
    assert.equal(staffImageError({ name, type, size: 20 * 1024 * 1024 }), '');
  }
  assert.match(staffImageError({ name: 'a.png', type: 'image/png', size: 20 * 1024 * 1024 + 1 }), /20 MB/);
  assert.match(staffImageError({ name: 'a.png', type: 'image/png', size: 0 }), /có dữ liệu/);
  assert.match(staffImageError({ name: 'a.gif', type: 'image/gif', size: 10 }), /JPG, PNG hoặc WebP/);
  assert.match(staffImageError({ name: 'a.jpg', type: 'image/png', size: 10 }), /JPG, PNG hoặc WebP/);
});

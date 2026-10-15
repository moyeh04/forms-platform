const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');

test('Slots: generator reproduces the old seminar timetable style', () => {
  const slots = R.generateSlots({
    start: '12:30',
    end: '15:30',
    length: 20,
    gap: 5
  });
  assert.deepEqual(slots.slice(0, 3), [
    '12:30 - 12:50',
    '12:55 - 1:15',
    '1:20 - 1:40'
  ]);
  assert.equal(
    R.generateSlots({ start: '10:00', end: '09:00', length: 10 }).length,
    0
  );
  assert.deepEqual(
    R.generateSlots({ start: '13:00', end: '13:40', length: 20, style: '24h' }),
    ['13:00 - 13:20', '13:20 - 13:40']
  );
});

test('Slots: the room left is the capacity less the other bookings', () => {
  const form = { slots: { capacity: 3 } };
  assert.equal(R.slotRoom(form, { 'd|1': 2 }, 'd|1'), 1);
  assert.equal(R.slotRoom(form, { 'd|1': 5 }, 'd|1'), 0, 'never below none');
  assert.equal(
    R.slotRoom({ slots: {} }, {}, 'd|1'),
    1,
    'one booking a slot when no capacity is set'
  );
});

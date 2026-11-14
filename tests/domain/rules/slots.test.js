const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../../domain/rules/index.js");

test("Slots: generator reproduces the old seminar timetable style", () => {
  const slots = R.generateSlots({
    start: "12:30",
    end: "15:30",
    length: 20,
    gap: 5,
  });
  assert.deepEqual(slots.slice(0, 3), ["12:30 - 12:50", "12:55 - 1:15", "1:20 - 1:40"]);
  assert.equal(R.generateSlots({ start: "10:00", end: "09:00", length: 10 }).length, 0);
  assert.deepEqual(R.generateSlots({ start: "13:00", end: "13:40", length: 20, style: "24h" }), [
    "13:00 - 13:20",
    "13:20 - 13:40",
  ]);
});

test("Slots: the room left is the capacity less the other bookings", () => {
  const form = { slots: { capacity: 3 } };
  assert.equal(R.slotRoom(form, { "d|1": 2 }, "d|1"), 1);
  assert.equal(R.slotRoom(form, { "d|1": 5 }, "d|1"), 0, "never below none");
  assert.equal(
    R.slotRoom({ slots: {} }, {}, "d|1"),
    1,
    "one booking a slot when no capacity is set",
  );
});

test("Slots: a day before today is over; today and later are not", () => {
  assert.equal(R.isPastDate("2026-11-04", "2026-11-05"), true);
  assert.equal(R.isPastDate("2026-11-05", "2026-11-05"), false);
  assert.equal(R.isPastDate("2026-11-06", "2026-11-05"), false);
  assert.equal(R.isPastDate("", "2026-11-05"), false, "no date is not over");
});

test("Slots: a time of today is past once it starts", () => {
  const day = {
    date: "2026-11-07",
    times: ["12:30 - 12:50", "12:55 - 1:15", "1:20 - 1:40"],
  };
  assert.deepEqual(R.slotStarts(day.times), [750, 775, 800], "afternoon");
  assert.deepEqual(
    R.slotStarts(["9:00 - 9:20", "11:40 - 12:00", "12:00 - 12:20"]),
    [540, 700, 720],
    "a morning that runs past noon",
  );
  const at = (time) => ({ date: "2026-11-07", time });
  assert.equal(R.isPastSlot(day, "12:30 - 12:50", at("12:30")), true);
  assert.equal(R.isPastSlot(day, "12:55 - 1:15", at("12:30")), false);
  assert.equal(R.isPastSlot(day, "1:20 - 1:40", at("13:19")), false);
  assert.equal(R.isPastDay(day, at("13:19")), false);
  assert.equal(R.isPastDay(day, at("13:20")), true);
  assert.equal(
    R.isPastSlot(day, "12:30 - 12:50", { date: "2026-11-06", time: "23:00" }),
    false,
    "a later day is open",
  );
});

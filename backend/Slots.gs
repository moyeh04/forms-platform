/** Reservation slots: configuration checks, availability, and labels. */

/** Cleans the slot configuration an admin saves. */
function normalizeSlots_(slots) {
  var days = (slots && slots.days) || [];
  var capacity = parseInt(slots && slots.capacity, 10);
  if (!(capacity >= 1)) capacity = 1;
  var seen = {};
  var out = days.map(function (d, i) {
    var label = String(d.label || '').trim();
    if (!label) fail('bad_slots', 'Every day needs a name, for example "Week 11 - Sunday".');
    var id = slugify(d.id || label);
    var base = id, n = 2;
    while (seen[id]) id = base + '-' + n++;
    seen[id] = true;
    var date = String(d.date || '').trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('bad_slots', 'Dates must look like 2027-11-14.');
    var times = [];
    (d.times || []).forEach(function (t) {
      t = String(t).replace(/\s+/g, ' ').trim();
      if (t && times.indexOf(t) === -1) times.push(t);
    });
    if (!times.length) fail('bad_slots', '"' + label + '" has no time slots.');
    return { id: id, label: label, date: date, times: times };
  });
  return { days: out, capacity: capacity };
}

/** How many bookings each slot has: { "day|time": count }. No personal data. */
function slotAvailability_(form) {
  var taken = {};
  readResponses(form).forEach(function (r) {
    if (r.slot) taken[r.slot] = (taken[r.slot] || 0) + 1;
  });
  return taken;
}

function slotParts_(form, key) {
  var parts = String(key).split('|');
  var days = (form.slots && form.slots.days) || [];
  var day = days.filter(function (d) { return d.id === parts[0]; })[0];
  return { dayId: parts[0], time: parts.slice(1).join('|'), day: day || null };
}

function slotLabel_(form, key) {
  var p = slotParts_(form, key);
  return (p.day ? p.day.label : p.dayId) + '  -  ' + p.time;
}

/** Bookings whose slot no longer exists in the configuration. */
function orphanedBookings_(form) {
  var valid = {};
  ((form.slots && form.slots.days) || []).forEach(function (d) {
    d.times.forEach(function (t) { valid[Rules.slotKey(d.id, t)] = true; });
  });
  return readResponses(form).filter(function (r) { return r.slot && !valid[r.slot]; }).length;
}

/** Booking a reservation with the key of a registration in another form. */

var API = API || {};

/** Forms a reservation may take keys from: any other form that gives its students a key. */
function keyBookingSources_(form) {
  return readForms().filter(function (f) {
    return f.id !== form.id && issuesKeys_(f);
  });
}

/** Cleans the setting an admin saves. Switched on, it must name a form that issues keys. */
function normalizeKeyBooking_(form, next) {
  var enabled = !!(next && next.enabled);
  var source = String((next && next.source) || '');
  if (!enabled) return { enabled: false, source: source };
  if (form.type !== 'reservation') fail('bad_key_booking', 'Only a reservation form can be booked with a key.');
  var ok = keyBookingSources_(form).some(function (f) { return f.id === source; });
  if (!ok) fail('bad_key_booking', 'Choose the registration form whose keys students book with.');
  return { enabled: true, source: source };
}

/** The form whose keys open this reservation, or null when it is filled in by hand. */
function keyBookingSource_(form) {
  var kb = form.keyBooking;
  if (form.type !== 'reservation' || !kb || !kb.enabled || !kb.source) return null;
  var source = findForm(kb.source);
  return source && source.id !== form.id ? source : null;
}

function requireKeyBookingSource_(form) {
  var source = keyBookingSource_(form);
  if (!source) fail('key_booking_off', 'This form is not booked with a key.');
  return source;
}

/** A registration key stays valid for booking after it has expired for editing. */
function registrationByKey_(source, key) {
  return findByKey_(source, key, true);
}

/**
 * The booking's answers: every question the two forms share is copied from the
 * registration, which was validated when it was made. Only the slot is new.
 */
function bookingData_(form, source, row, slot) {
  var data = {};
  (form.fields || []).forEach(function (f) {
    if (f.enabled === false || f.role === 'slot') return;
    var from = (source.fields || []).filter(function (s) { return s.id === f.id && s.type === f.type; })[0];
    if (!from && f.role) from = (source.fields || []).filter(function (s) { return s.role === f.role && s.type === f.type; })[0];
    var value = from ? row.data[from.id] : undefined;
    if (value !== undefined && value !== '') data[f.id] = clone(value);
  });
  return withSlot_(form, data, slot);
}

/** `data` with the slot the student picked, checked against the timetable. */
function withSlot_(form, data, slot) {
  var slotField = Rules.fieldByRole(form, 'slot');
  var checked = Rules.validateField(slotField, slot, { form: form });
  if (!checked.ok) {
    var errors = {};
    errors[slotField.id] = { error: checked.error };
    fail('invalid', 'Some answers need fixing.', errors);
  }
  data[slotField.id] = checked.value;
  return data;
}

/** The saved answers of a booking with the slot from `typed`; anything else that was typed is ignored. */
function movedBooking_(form, saved, typed) {
  return withSlot_(form, clone(saved), typed[Rules.fieldByRole(form, 'slot').id]);
}

/** What the student sees before booking, to confirm the key is theirs. No contact details. */
function teamPreview_(source, row) {
  var members = Rules.membersOf(source, row.data);
  return {
    ref: row.ref,
    leader: String(Rules.valueByRole(source, row.data, 'name') || ''),
    code: String(Rules.valueByRole(source, row.data, 'code') || ''),
    title: String(Rules.valueByRole(source, row.data, 'title') || ''),
    size: members.length
  };
}

API.bookingTeam = function (req) {
  var form = requireForm(String(req.slug || ''));
  assertAcceptingSubmissions_(form);
  var source = requireKeyBookingSource_(form);
  var row = registrationByKey_(source, req.key);
  var code = Rules.fieldByRole(form, 'code');
  var booking = readResponses(form).filter(function (r) { return code && String(r.data[code.id]) === String(row.data[Rules.fieldByRole(source, 'code').id]); })[0];
  var out = { team: teamPreview_(source, row), booked: !!booking };
  // The team's own time, so the page can show it beside the way to change it.
  if (booking) {
    out.slot = booking.data[Rules.fieldByRole(form, 'slot').id] || null;
    out.canMove = editScope_(form) === 'slot';
  }
  return out;
};


/* ── A series of bookings under one registration form ───────────── */

/** True for a form whose keys can book: it issues keys and asks for a code. */
function issuesKeys_(f) {
  return f.type !== 'reservation' && !!(f.editKey && f.editKey.enabled) && !!Rules.fieldByRole(f, 'code');
}

/** The reservations that are booked with the keys of this form, oldest first. */
function bookingsOf_(source) {
  return readForms().filter(function (f) {
    return f.type === 'reservation' && f.keyBooking && f.keyBooking.enabled && f.keyBooking.source === source.id;
  }).sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); });
}

/** "Discussion - Week 3" gives "Discussion - Week 4"; a title with no number gets " 2". */
function nextTitle_(title) {
  var m = /^(.*?)(\d+)(\D*)$/.exec(String(title));
  return m ? m[1] + (parseInt(m[2], 10) + 1) + m[3] : String(title) + ' 2';
}

/**
 * The same timetable one week later. A day named after its date is named after the new
 * date, and a "Week 11" in a typed name becomes "Week 12". A day with no date is kept.
 */
function nextWeekSlots_(slots) {
  var days = ((slots && slots.days) || []).map(function (d) {
    if (!d.date) return { label: d.label, date: '', times: d.times.slice() };
    var date = Rules.shiftDate(d.date, 7);
    var label = d.label === Rules.dayLabel(d.date) ? Rules.dayLabel(date)
      : String(d.label).replace(/(week\s*)(\d+)/i, function (all, word, n) { return word + (parseInt(n, 10) + 1); });
    return { label: label, date: date, times: d.times.slice() };
  });
  return normalizeSlots_({ days: days, capacity: slots && slots.capacity, pattern: slots && slots.pattern });
}

/**
 * The next booking form of a registration form. The first one is a new reservation that
 * books with the keys of that form. Each later one is a copy of the newest: same questions,
 * rules and hours, the days one week later, no bookings, and its own sheet. It is a draft.
 */
API['admin.bookings.next'] = admin(function (req) {
  var source = requireForm(req.source);
  if (!issuesKeys_(source)) fail('bad_key_booking', 'Only a form that gives its students a key can have bookings.');
  var series = bookingsOf_(source);
  var last = series[series.length - 1];
  var title = String(req.title || '').trim();
  var form;
  if (last) {
    form = duplicateForm(last.id, { title: title || nextTitle_(last.title) }, function (copy) {
      if (copy.slots && copy.slots.days.length) copy.slots = nextWeekSlots_(copy.slots);
      copy.opensAt = '';
      copy.closesAt = '';
    });
  } else {
    if (!title) fail('title_required', 'Give the booking a title.');
    form = createForm(Object.assign({ type: 'reservation', title: title }, FormMetadata.read(source)), function (made) {
      made.keyBooking = { enabled: true, source: source.id };
    });
  }
  return { form: form, copied: !!last, number: series.length + 1 };
});

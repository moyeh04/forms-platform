/** Booking a reservation with the key of a registration in another form. */

var API = API || {};

/** Forms a reservation may take keys from: any other form that gives its students a key. */
function keyBookingSources_(form) {
  return readForms().filter(function (f) {
    return f.id !== form.id && f.type !== 'reservation' && f.editKey && f.editKey.enabled && Rules.fieldByRole(f, 'code');
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
  var booked = readResponses(form).some(function (r) { return code && String(r.data[code.id]) === String(row.data[Rules.fieldByRole(source, 'code').id]); });
  return { team: teamPreview_(source, row), booked: booked };
};

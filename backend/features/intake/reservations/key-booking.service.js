/**
 * Booking a slot with the key of a registration, and the next week of slots.
 */

/** Forms a reservation may take keys from: any other form that gives its students a key. */
function keyBookingSources_(form) {
  return FormsRepository.readForms().filter(function (f) {
    return f.id !== form.id && issuesKeys_(f);
  });
}

/** Cleans the setting an admin saves. Switched on, it must name a form that issues keys. */
function normalizeKeyBooking_(form, next) {
  var enabled = !!(next && next.enabled);
  var source = String((next && next.source) || '');
  if (!enabled) return { enabled: false, source: source };
  if (form.type !== 'reservation')
    ApiError.fail(
      'bad_key_booking',
      'Only a reservation form can be booked with a key.'
    );
  var ok = keyBookingSources_(form).some(function (f) {
    return f.id === source;
  });
  if (!ok)
    ApiError.fail(
      'bad_key_booking',
      'Choose the registration form whose keys students book with.'
    );
  return { enabled: true, source: source };
}

/** The form whose keys open this reservation, or null when it is filled in by hand. */
function keyBookingSource_(form) {
  var kb = form.keyBooking;
  if (form.type !== 'reservation' || !kb || !kb.enabled || !kb.source)
    return null;
  var source = FormsRepository.findForm(kb.source);
  return source && source.id !== form.id ? source : null;
}

function requireKeyBookingSource_(form) {
  var source = keyBookingSource_(form);
  if (!source) ApiError.fail('key_booking_off', 'This form is not booked with a key.');
  return source;
}

/** A registration key stays valid for booking after it has expired for editing. */
function registrationByKey_(source, key) {
  return KeysService.findByKey(source, key, true);
}

/**
 * The booking's answers: every question the two forms share is copied from the
 * registration, which was validated when it was made. Only the slot is new.
 */
function bookingData_(form, source, row, slot) {
  var data = {};
  (form.fields || []).forEach(function (f) {
    if (f.enabled === false || f.role === 'slot') return;
    var from = (source.fields || []).filter(function (s) {
      return s.id === f.id && s.type === f.type;
    })[0];
    if (!from && f.role)
      from = (source.fields || []).filter(function (s) {
        return s.role === f.role && s.type === f.type;
      })[0];
    var value = from ? row.data[from.id] : undefined;
    if (value !== undefined && value !== '') data[f.id] = Json.clone(value);
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
    ApiError.fail('invalid', 'Some answers need fixing.', errors);
  }
  data[slotField.id] = checked.value;
  return data;
}

/** The saved answers of a booking with the slot from `typed`; anything else that was typed is ignored. */
function movedBooking_(form, saved, typed) {
  return withSlot_(
    form,
    Json.clone(saved),
    typed[Rules.fieldByRole(form, 'slot').id]
  );
}

/** What the student sees before booking, to confirm the key is theirs: names, no contact details. */
function teamPreview_(source, row) {
  var members = Rules.membersOf(source, row.data);
  return {
    ref: row.ref,
    leader: String(Rules.valueByRole(source, row.data, 'name') || ''),
    code: String(Rules.valueByRole(source, row.data, 'code') || ''),
    title: String(Rules.valueByRole(source, row.data, 'title') || ''),
    size: members.length,
    teammates: members
      .filter(function (m) {
        return !m.leader;
      })
      .map(function (m) {
        return String(m.name);
      })
  };
}

/** True for a form whose keys can book: it issues keys and asks for a code. */
function issuesKeys_(f) {
  return (
    f.type !== 'reservation' &&
    !!(f.editKey && f.editKey.enabled) &&
    !!Rules.fieldByRole(f, 'code')
  );
}

/** The reservations that are booked with the keys of this form, oldest first. */
function bookingsOf_(source) {
  return FormsRepository.readForms()
    .filter(function (f) {
      return (
        f.type === 'reservation' &&
        f.keyBooking &&
        f.keyBooking.enabled &&
        f.keyBooking.source === source.id
      );
    })
    .sort(function (a, b) {
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
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
    var label =
      d.label === Rules.dayLabel(d.date)
        ? Rules.dayLabel(date)
        : String(d.label).replace(/(week\s*)(\d+)/i, function (all, word, n) {
            return word + (parseInt(n, 10) + 1);
          });
    return { label: label, date: date, times: d.times.slice() };
  });
  return normalizeSlots_({
    days: days,
    capacity: slots && slots.capacity,
    pattern: slots && slots.pattern
  });
}

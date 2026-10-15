/**
 * Booking a slot with the key of a registration: the source form, the
 * answers copied from the registration, and the team behind a key.
 */

var KeyBookingService = (function () {
  /**
   * Lists the forms a reservation may take keys from: any other form that
   * gives its students a key.
   *
   * @param {!Object} form The reservation form.
   * @return {!Array<!Object>} The forms.
   */
  function keyBookingSources_(form) {
    return FormsRepository.readForms().filter(function (f) {
      return f.id !== form.id && issuesKeys_(f);
    });
  }

  /**
   * Cleans the key booking setting an admin saves. Switched on, it must name
   * a form that issues keys.
   *
   * @param {!Object} form The form.
   * @param {?Object} next The setting as saved.
   * @return {{enabled: boolean, source: string}} The setting.
   * @throws {ApiError} `bad_key_booking` for a form that cannot use it.
   */
  function normalizeKeyBooking_(form, next) {
    var enabled = !!next?.enabled;
    var source = String(next?.source || '');
    if (!enabled) return { enabled: false, source: source };
    if (form.type !== FormType.RESERVATION)
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

  /**
   * Finds the form whose keys open a reservation.
   *
   * @param {!Object} form The form.
   * @return {?Object} The source form, or null when the reservation is
   *     filled in by hand.
   */
  function keyBookingSource_(form) {
    var kb = form.keyBooking;
    if (form.type !== FormType.RESERVATION || !kb?.enabled || !kb.source)
      return null;
    var source = FormsRepository.findForm(kb.source);
    return source && source.id !== form.id ? source : null;
  }

  /**
   * Finds the form whose keys open a reservation, or fails.
   *
   * @param {!Object} form The form.
   * @return {!Object} The source form.
   * @throws {ApiError} `key_booking_off` when the form is filled in by hand.
   */
  function requireKeyBookingSource_(form) {
    var source = keyBookingSource_(form);
    if (!source)
      ApiError.fail('key_booking_off', 'This form is not booked with a key.');
    return source;
  }

  /**
   * Finds the registration a key opens. A registration key stays valid for
   * booking after it has expired for editing.
   *
   * @param {!Object} source The registration form.
   * @param {*} key The key.
   * @return {!Object} The registration.
   */
  function registrationByKey_(source, key) {
    return KeysService.findByKey(source, key, true);
  }

  /**
   * Finds the question of the registration form that matches a question of
   * the booking form: the same id and type, or else the same role and type.
   *
   * @param {!Object} source The registration form.
   * @param {!Object} f The question of the booking form.
   * @return {?Object} The question, or null.
   */
  function sharedField_(source, f) {
    var fields = source.fields || [];
    var same = function (key) {
      return fields.filter(function (s) {
        return s[key] === f[key] && s.type === f.type;
      })[0];
    };
    return same('id') || (f.role ? same('role') : null) || null;
  }

  /**
   * Makes the answers of a booking: every question the two forms share is
   * copied from the registration, which was validated when it was made.
   * Only the slot is new.
   *
   * @param {!Object} form The booking form.
   * @param {!Object} source The registration form.
   * @param {!Object} row The registration.
   * @param {*} slot The slot the student picked.
   * @return {!Object} The answers.
   */
  function bookingData_(form, source, row, slot) {
    var data = {};
    (form.fields || []).forEach(function (f) {
      if (f.enabled === false || f.role === 'slot') return;
      var from = sharedField_(source, f);
      var value = from ? row.data[from.id] : undefined;
      if (value !== undefined && value !== '') data[f.id] = Json.clone(value);
    });
    return withSlot_(form, data, slot);
  }

  /**
   * Adds the slot the student picked, checked against the timetable.
   *
   * @param {!Object} form The booking form.
   * @param {!Object} data The answers, changed in place.
   * @param {*} slot The slot.
   * @return {!Object} The same answers.
   * @throws {ApiError} `invalid` when the slot is not right.
   */
  function withSlot_(form, data, slot) {
    var slotField = Rules.fieldByRole(form, 'slot');
    var checked = Rules.validateField(slotField, slot, { form: form });
    var errors = {};
    if (!checked.ok) {
      errors[slotField.id] = { error: checked.error };
      ApiError.fail('invalid', 'Some answers need fixing.', errors);
    }
    data[slotField.id] = checked.value;
    return data;
  }

  /**
   * Gives the saved answers of a booking with the slot from `typed`;
   * anything else that was typed is ignored.
   *
   * @param {!Object} form The booking form.
   * @param {!Object} saved The saved answers.
   * @param {!Object} typed The answers as sent.
   * @return {!Object} The answers with the new slot.
   */
  function movedBooking_(form, saved, typed) {
    return withSlot_(
      form,
      Json.clone(saved),
      typed[Rules.fieldByRole(form, 'slot').id]
    );
  }

  /**
   * Gives what the student sees before booking, to confirm the key is
   * theirs: names, no contact details.
   *
   * @param {!Object} source The registration form.
   * @param {!Object} row The registration.
   * @return {!Object} The ref, leader, code, title, size and teammates.
   */
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

  /**
   * Says whether the keys of a form can book: it issues keys and asks for a
   * code.
   *
   * @param {!Object} f The form.
   * @return {boolean} True when its keys can book.
   */
  function issuesKeys_(f) {
    return (
      f.type !== FormType.RESERVATION &&
      !!f.editKey?.enabled &&
      !!Rules.fieldByRole(f, 'code')
    );
  }

  /**
   * Says what the student sees after typing a registration key: the team,
   * and its booking when it has one.
   *
   * @param {!Object} form The booking form.
   * @param {*} key The registration key.
   * @return {!Object} The team, whether it is booked, and its slot and
   *     whether it may move.
   */
  function bookingTeam_(form, key) {
    var source = requireKeyBookingSource_(form);
    var row = registrationByKey_(source, key);
    var code = Rules.fieldByRole(form, 'code');
    var teamCode = String(row.data[Rules.fieldByRole(source, 'code').id]);
    var booking = ResponsesRepository.readResponses(form).filter(function (r) {
      return code && String(r.data[code.id]) === teamCode;
    })[0];
    var out = { team: teamPreview_(source, row), booked: !!booking };
    // The team's own time, so the page can show it beside the way to change it.
    if (booking) {
      out.slot = booking.data[Rules.fieldByRole(form, 'slot').id] || null;
      out.canMove = SubmissionsService.editScope(form) === 'slot';
    }
    return out;
  }

  return {
    keyBookingSources: keyBookingSources_,
    keyBookingSource: keyBookingSource_,
    normalizeKeyBooking: normalizeKeyBooking_,
    requireKeyBookingSource: requireKeyBookingSource_,
    registrationByKey: registrationByKey_,
    teamPreview: teamPreview_,
    issuesKeys: issuesKeys_,
    bookingData: bookingData_,
    movedBooking: movedBooking_,
    bookingTeam: bookingTeam_
  };
})();

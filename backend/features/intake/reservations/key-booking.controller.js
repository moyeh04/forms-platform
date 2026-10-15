/**
 * The booking actions: the team behind a key, and the next week of bookings.
 */

var API = API || {};

API.bookingTeam = function (req) {
  var form = FormsRepository.requireForm(String(req.slug || ''));
  ResponsesRules.assertAcceptingSubmissions(form);
  var source = requireKeyBookingSource_(form);
  var row = registrationByKey_(source, req.key);
  var code = Rules.fieldByRole(form, 'code');
  var booking = ResponsesRepository.readResponses(form).filter(function (r) {
    return (
      code &&
      String(r.data[code.id]) ===
        String(row.data[Rules.fieldByRole(source, 'code').id])
    );
  })[0];
  var out = { team: teamPreview_(source, row), booked: !!booking };
  // The team's own time, so the page can show it beside the way to change it.
  if (booking) {
    out.slot = booking.data[Rules.fieldByRole(form, 'slot').id] || null;
    out.canMove = editScope_(form) === 'slot';
  }
  return out;
};

/**
 * The next booking form of a registration form. The first one is a new reservation that
 * books with the keys of that form. Each later one is a copy of the newest: same questions,
 * rules and hours, the days one week later, no bookings, and its own sheet. It is a draft.
 */
API['admin.bookings.next'] = AuthService.admin(function (req) {
  var source = FormsRepository.requireForm(req.source);
  if (!issuesKeys_(source))
    ApiError.fail(
      'bad_key_booking',
      'Only a form that gives its students a key can have bookings.'
    );
  var series = bookingsOf_(source);
  var last = series[series.length - 1];
  var title = String(req.title || '').trim();
  var form;
  if (last) {
    form = FormsService.duplicateForm(
      last.id,
      { title: title || nextTitle_(last.title) },
      function (copy) {
        if (copy.slots && copy.slots.days.length)
          copy.slots = nextWeekSlots_(copy.slots);
        copy.opensAt = '';
        copy.closesAt = '';
      }
    );
  } else {
    if (!title) ApiError.fail('title_required', 'Give the booking a title.');
    form = FormsService.createForm(
      Object.assign(
        { type: 'reservation', title: title },
        FormMetadata.read(source)
      ),
      function (made) {
        made.keyBooking = { enabled: true, source: source.id };
      }
    );
  }
  return { form: form, copied: !!last, number: series.length + 1 };
});

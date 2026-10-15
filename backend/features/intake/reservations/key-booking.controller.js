/**
 * The booking actions: the team behind a key, and the next week of bookings.
 */

var KeyBookingController = (function () {
  /**
   * Answers the `bookingTeam` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function bookingTeam(req) {
    var form = FormsRepository.requireForm(String(req.slug || ''));
    ResponsesRules.assertAcceptingSubmissions(form);
    var source = KeyBookingService.requireKeyBookingSource(form);
    var row = KeyBookingService.registrationByKey(source, req.key);
    var code = Rules.fieldByRole(form, 'code');
    var booking = ResponsesRepository.readResponses(form).filter(function (r) {
      return (
        code &&
        String(r.data[code.id]) ===
          String(row.data[Rules.fieldByRole(source, 'code').id])
      );
    })[0];
    var out = {
      team: KeyBookingService.teamPreview(source, row),
      booked: !!booking
    };
    // The team's own time, so the page can show it beside the way to change it.
    if (booking) {
      out.slot = booking.data[Rules.fieldByRole(form, 'slot').id] || null;
      out.canMove = SubmissionsService.editScope(form) === 'slot';
    }
    return out;
  }

  /**
   * The next booking form of a registration form. The first one is a new reservation that
   * books with the keys of that form. Each later one is a copy of the newest: same questions,
   * rules and hours, the days one week later, no bookings, and its own sheet. It is a draft.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function next(req) {
    var source = FormsRepository.requireForm(req.source);
    if (!KeyBookingService.issuesKeys(source))
      ApiError.fail(
        'bad_key_booking',
        'Only a form that gives its students a key can have bookings.'
      );
    var series = KeyBookingService.bookingsOf(source);
    var last = series[series.length - 1];
    var title = String(req.title || '').trim();
    var form;
    if (last) {
      form = FormsService.duplicateForm(
        last.id,
        { title: title || KeyBookingService.nextTitle(last.title) },
        function (copy) {
          if (copy.slots && copy.slots.days.length)
            copy.slots = KeyBookingService.nextWeekSlots(copy.slots);
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
  }

  return { bookingTeam, next };
})();

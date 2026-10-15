/**
 * The rows a private link reads: bookings, teams and WhatsApp registrations.
 */

var ViewerService = (function () {
  /** Where a booking on a day the form no longer lists sorts: after all. */
  var UNKNOWN_DAY_ = 999;

  /** The sort weight of one day, larger than the number of times a day has. */
  var DAY_WEIGHT_ = 1000;

  /**
   * Reads a form the private link may see.
   *
   * @param {!Object} client The private link.
   * @param {*} slug The slug of the form.
   * @return {!Object} The form.
   * @throws {ApiError} `forbidden` when the link may not see it, or it is a
   *     draft or archived.
   */
  function requireClientForm_(client, slug) {
    var form = FormsRepository.requireForm(String(slug || ''));
    if (
      !ClientsAccess.clientAllows(client, form) ||
      form.status === FormStatus.DRAFT ||
      form.status === FormStatus.ARCHIVED
    )
      ApiError.fail('forbidden', 'You do not have access to this form.');
    return form;
  }

  /**
   * Joins the names of the teammates of a booking, the leader left out.
   *
   * @param {!Object} form The form.
   * @param {!Object} r The response.
   * @return {string} The names, separated by commas.
   */
  function teammates_(form, r) {
    return Rules.membersOf(form, r.data)
      .filter(function (m) {
        return !m.leader;
      })
      .map(function (m) {
        return m.name;
      })
      .join(', ');
  }

  /**
   * Makes the row of one booking, with the order it sorts in.
   *
   * @param {!Object} form The form.
   * @param {!Object} r The response.
   * @param {!Array<!Object>} days The days of the form.
   * @param {boolean} includeMembers True when the form asks for teammates.
   * @return {!Object} The row, with `_order` for sorting.
   */
  function reservationRow_(form, r, days, includeMembers) {
    var p = SlotsRules.slotParts(form, r.slot);
    var di = days.indexOf(p.day);
    var day = p.day || { label: p.dayId, date: '', times: [] };
    return {
      _order:
        (di < 0 ? UNKNOWN_DAY_ : di) * DAY_WEIGHT_ +
        (p.day ? day.times.indexOf(p.time) : 0),
      id: r.id,
      dayId: p.dayId,
      dayLabel: day.label,
      date: day.date,
      time: p.time,
      name: r.name,
      code: r.code,
      phone: r.phone,
      email: r.email,
      title: r.title,
      level: r.data.level || '',
      section: r.data.section || '',
      members: includeMembers ? teammates_(form, r) : ''
    };
  }

  /**
   * Lists the bookings of a reservation form in day and time order.
   *
   * @param {!Object} form The form.
   * @param {!Object} client The private link, whose hidden columns are left
   *     out.
   * @param {string} mode `today`, `day` or `all`.
   * @param {string} dayId The day to keep when the mode is `day`.
   * @return {!Array<!Object>} The rows.
   */
  function reservationRows_(form, client, mode, dayId) {
    var days = form.slots?.days || [];
    var today = Time.todayIso();
    var membersField = Rules.fieldByRole(form, 'members');
    var includeMembers = !!membersField && membersField.enabled !== false;
    var rows = ResponsesRepository.readResponses(form)
      .filter(function (r) {
        return r.slot;
      })
      .map(function (r) {
        return reservationRow_(form, r, days, includeMembers);
      });
    if (mode === 'today')
      rows = rows.filter(function (r) {
        return r.date && r.date === today;
      });
    if (mode === 'day')
      rows = rows.filter(function (r) {
        return r.dayId === dayId;
      });
    rows.sort(function (a, b) {
      return a._order - b._order;
    });
    return rows.map(function (r) {
      delete r._order;
      return ViewerRules.stripHidden(r, client.hiddenColumns);
    });
  }

  /**
   * Lists the warnings about small teams that an instructor sees.
   *
   * @param {!Object} form The form.
   * @param {!Object} client The private link.
   * @return {!Array<!Object>} The levels that are on, or none when the link
   *     does not show them.
   */
  function viewerSizeAlerts_(form, client) {
    return client.showSizeAlerts
      ? Rules.sizeAlertLevels(Rules.sizeAlerts(form))
      : [];
  }

  /**
   * Lists the teams of a form in number order, each with its members and the
   * columns the link may see.
   *
   * @param {!Object} form The form.
   * @param {!Object} client The private link.
   * @return {!Array<!Object>} One group for each team.
   */
  function teamGroups_(form, client) {
    var alerts = Rules.sizeAlerts(form);
    return TeamNumbers.numberedResponses(form)
      .sort(TeamNumbers.byTeamNumber)
      .map(function (r) {
        var g = {
          id: r.id,
          ref: r.ref,
          number: r.number,
          status: r.status,
          title: r.title,
          link: r.link,
          members: Rules.membersOf(form, r.data)
        };
        var alert = client.showSizeAlerts
          ? Rules.sizeAlertOf(alerts, g.members.length)
          : '';
        if (alert) g.alert = alert;
        var hidden = client.hiddenColumns;
        if (hidden.indexOf('title') !== -1) delete g.title;
        if (hidden.indexOf('link') !== -1) delete g.link;
        g.members = g.members.map(function (m) {
          return ViewerRules.stripHidden(
            {
              name: m.name,
              section: m.section,
              code: m.code,
              phone: m.phone,
              leader: m.leader
            },
            ['name', 'section', 'code', 'phone'].filter(function (k) {
              return hidden.indexOf(k) !== -1;
            })
          );
        });
        return g;
      });
  }

  /**
   * Lists the registrations of a WhatsApp form, oldest first.
   *
   * @param {!Object} form The form.
   * @param {!Object} client The private link.
   * @return {!Array<!Object>} The rows, without the hidden columns.
   */
  function whatsappRows_(form, client) {
    return ResponsesRepository.readResponses(form)
      .sort(SheetViewsBuilder.byCreated)
      .map(function (r) {
        return ViewerRules.stripHidden(
          {
            id: r.id,
            name: r.name,
            code: r.code,
            phone: r.phone,
            level: r.data.level || '',
            group: r.data.group || '',
            section: r.data.section || '',
            link: r.link,
            review: r.review,
            status: r.status
          },
          client.hiddenColumns
        );
      });
  }

  /**
   * Sets the status of one review step of a submission and saves it.
   *
   * @param {!Object} form The form.
   * @param {string} submissionId The id of the submission.
   * @param {string} stepId The review step.
   * @param {string} status Its new status.
   * @throws {ApiError} `submission_not_found` when there is no such
   *     submission.
   */
  function reviewSubmission_(form, submissionId, stepId, status) {
    Lock.withLock(function () {
      var r = ResponsesRepository.readResponses(form).filter(function (x) {
        return x.id === submissionId;
      })[0];
      if (!r)
        ApiError.fail(
          'submission_not_found',
          'That submission does not exist.'
        );
      ResponsesReview.setReviewStep(form, r, stepId, status);
      ResponsesRepository.saveResponse(form, r);
    });
  }

  return {
    requireClientForm: requireClientForm_,
    reviewSubmission: reviewSubmission_,
    reservationRows: reservationRows_,
    teamGroups: teamGroups_,
    viewerSizeAlerts: viewerSizeAlerts_,
    whatsappRows: whatsappRows_
  };
})();

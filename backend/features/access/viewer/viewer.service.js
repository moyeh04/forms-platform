/**
 * The rows a private link reads: bookings, teams and WhatsApp registrations.
 */

var ViewerService = (function () {
  function requireClientForm_(client, slug) {
    var form = FormsRepository.requireForm(String(slug || ''));
    if (
      !ClientsAccess.clientAllows(client, form) ||
      form.status === 'draft' ||
      form.status === 'archived'
    )
      ApiError.fail('forbidden', 'You do not have access to this form.');
    return form;
  }

  function reservationRows_(form, client, mode, dayId) {
    var days = (form.slots && form.slots.days) || [];
    var today = Time.todayIso();
    var membersField = Rules.fieldByRole(form, 'members');
    var includeMembers = !!(membersField && membersField.enabled !== false);
    var rows = ResponsesRepository.readResponses(form)
      .filter(function (r) {
        return r.slot;
      })
      .map(function (r) {
        var p = SlotsRules.slotParts(form, r.slot);
        var di = days.indexOf(p.day);
        return {
          _order:
            (di < 0 ? 999 : di) * 1000 +
            (p.day ? p.day.times.indexOf(p.time) : 0),
          id: r.id,
          dayId: p.dayId,
          dayLabel: p.day ? p.day.label : p.dayId,
          date: p.day ? p.day.date : '',
          time: p.time,
          name: r.name,
          code: r.code,
          phone: r.phone,
          email: r.email,
          title: r.title,
          level: r.data.level || '',
          section: r.data.section || '',
          members: includeMembers
            ? Rules.membersOf(form, r.data)
                .filter(function (m) {
                  return !m.leader;
                })
                .map(function (m) {
                  return m.name;
                })
                .join(', ')
            : ''
        };
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

  /** The warnings about small teams that an instructor sees: the levels that are on, or none when the link does not show them. */
  function viewerSizeAlerts_(form, client) {
    return client.showSizeAlerts
      ? Rules.sizeAlertLevels(Rules.sizeAlerts(form))
      : [];
  }

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

  return {
    requireClientForm: requireClientForm_,
    reservationRows: reservationRows_,
    teamGroups: teamGroups_,
    viewerSizeAlerts: viewerSizeAlerts_,
    whatsappRows: whatsappRows_
  };
})();

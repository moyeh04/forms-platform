/**
 * Reservations: each day is its own block with its bookings in the order
 * of the timetable.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var Rules = window.Rules;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Draws a booking as a row of its day.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {boolean} showTeammates Whether the form asks for teammates.
   * @param {function()} reload Draws the page again.
   * @return {!Element} The row.
   */
  function bookingRow(form, s, showTeammates, reload) {
    var L = R.labelled;
    var teammates = (s.data.members || [])
      .map(function (member) {
        return member.name;
      })
      .filter(Boolean)
      .join(', ');
    return h(
      'tr',
      null,
      L('Time', h('td', { class: 'mono' }, s.data.slot.time)),
      L('Team leader', h('td', { class: 'nm' }, R.bdi(s.name))),
      L('Code', h('td', { class: 'mono' }, s.code)),
      L('Phone', h('td', { class: 'mono' }, s.phone)),
      L('Project', h('td', null, s.title)),
      showTeammates ? L('Teammates', h('td', null, teammates)) : null,
      L('Status', h('td', null, R.statusSelect(form, s))),
      h('td', null, R.detailsButton(form, s, reload))
    );
  }

  /**
   * Draws the head of the table of a day.
   *
   * @param {boolean} showTeammates Whether the form asks for teammates.
   * @return {!Element} The head.
   */
  function tableHead(showTeammates) {
    return h(
      'thead',
      null,
      h(
        'tr',
        null,
        h('th', null, 'Time'),
        h('th', null, 'Team leader'),
        h('th', null, 'Code'),
        h('th', null, 'Phone'),
        h('th', null, 'Project'),
        showTeammates ? h('th', null, 'Teammates') : null,
        h('th', null, 'Status'),
        h('th', null)
      )
    );
  }

  /**
   * Draws the bookings, grouped by day.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The submissions.
   * @param {function()} reload Draws the page again.
   * @return {!Element} The list.
   */
  R.bookings = function (form, rows, reload) {
    var members = Rules.fieldByRole(form, 'members');
    var showTeammates = !!members && members.enabled !== false;
    return h(
      'div',
      null,
      R.dayGroups(form, rows).map(function (g, i) {
        return h(
          'section',
          {
            class: 'block single ' + (i % 2 ? 'tint-b' : 'tint-a'),
            dataset: { day: g.id }
          },
          h(
            'div',
            { class: 'day-head' },
            h('span', null, g.label + (g.date ? ' (' + g.date + ')' : '')),
            h('span', null, g.rows.length + ' booked')
          ),
          h(
            'div',
            { class: 'scroll-x' },
            h(
              'table',
              { class: 'mini' },
              tableHead(showTeammates),
              h(
                'tbody',
                null,
                g.rows.map(function (s) {
                  return bookingRow(form, s, showTeammates, reload);
                })
              )
            )
          )
        );
      })
    );
  };
})(window.App);

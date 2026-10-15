/**
 * WhatsApp registrations: one table, by group and section, with a column
 * for each review step.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;

  /** The columns before the review steps. */
  var FIRST_COLUMNS = [
    'No.',
    'Name',
    'Code',
    'Phone',
    'Group',
    'Section',
    'Timetable'
  ];

  /**
   * Draws a registration as a row of the table.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {number} i Where it is in the table, from 0.
   * @param {function()} reload Draws the page again.
   * @return {!Element} The row.
   */
  function registrationRow(form, s, i, reload) {
    var L = R.labelled;
    var steps = form.review?.steps || [];
    return h(
      'tr',
      { dataset: { ref: s.ref } },
      h('td', { class: 'num' }, String(i + 1)),
      h('td', { class: 'nm' }, R.bdi(s.name)),
      L('Code', h('td', { class: 'mono' }, s.code)),
      L('Phone', h('td', { class: 'mono' }, s.phone)),
      L('Group', h('td', null, s.data.group || '')),
      L('Section', h('td', null, s.data.section || '')),
      L(
        'Timetable',
        h(
          'td',
          null,
          s.link
            ? h(
                'a',
                { href: s.link, target: '_blank', rel: 'noopener' },
                'Open'
              )
            : ''
        )
      ),
      steps.map(function (st) {
        return L(st.label.en, h('td', null, R.reviewSelect(form, s, st)));
      }),
      L('Status', h('td', null, R.statusSelect(form, s))),
      h('td', null, R.detailsButton(form, s, reload))
    );
  }

  /**
   * Draws the WhatsApp registrations.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The submissions.
   * @param {function()} reload Draws the page again.
   * @return {!Element} The table.
   */
  R.registrations = function (form, rows, reload) {
    var steps = form.review?.steps || [];
    var columns = FIRST_COLUMNS.concat(
      steps.map(function (s) {
        return s.label.en;
      })
    ).concat(['Status', '']);
    return h(
      'div',
      { class: 'scroll-x' },
      h(
        'table',
        { class: 'data-table cards' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            columns.map(function (c) {
              return h('th', null, c);
            })
          )
        ),
        h(
          'tbody',
          null,
          R.byGroup(rows).map(function (s, i) {
            return registrationRow(form, s, i, reload);
          })
        )
      )
    );
  };
})(window.App);

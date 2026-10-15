/**
 * Teams and tasks: each team is its own block with a tint and a heavy
 * border, as in the Google Sheet, with its members in a table.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var Rules = window.Rules;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  /** The size of the link icon beside a title. */
  var LINK_ICON = 15;
  /** The size of the star beside the leader. */
  var LEADER_ICON = 13;

  /**
   * Draws a member as a row of the team table.
   *
   * @param {!Object} m The member.
   * @param {number} k Where the member is in the team, from 0.
   * @return {!Element} The row.
   */
  function memberRow(m, k) {
    return h(
      'tr',
      { class: m.leader ? 'leader' : null },
      h('td', { class: 'num' }, String(k + 1)),
      h(
        'td',
        { class: 'nm' },
        R.bdi(m.name),
        m.leader
          ? h(
              'span',
              { class: 'lead-tag' },
              icon('star', LEADER_ICON),
              'Leader'
            )
          : null
      ),
      h('td', { dataset: { label: 'Section' } }, m.section || '-'),
      h('td', { class: 'mono', dataset: { label: 'Code' } }, m.code),
      h(
        'td',
        { class: 'mono tel', dataset: { label: 'Phone' } },
        m.phone ? h('a', { href: 'tel:' + m.phone }, m.phone) : '-'
      )
    );
  }

  /**
   * Draws the table of the members of a team.
   *
   * @param {!Array<!Object>} members The members.
   * @return {!Element} The table.
   */
  function memberTable(members) {
    return h(
      'div',
      { class: 'scroll-x' },
      h(
        'table',
        { class: 'mini' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', null, '#'),
            h('th', null, 'Team member'),
            h('th', null, 'Section'),
            h('th', null, 'Code'),
            h('th', null, 'Phone')
          )
        ),
        h('tbody', null, members.map(memberRow))
      )
    );
  }

  /**
   * Draws the title of a team, a link when it has one.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @return {!Element} The title.
   */
  function titleOf(form, s) {
    var third = form.type === FormType.TASK_SUBMISSION ? 'Task' : 'Project';
    var title = s.title || '-';
    return h(
      'div',
      { class: 'block-side block-title' },
      h('span', { class: 'kicker' }, third),
      s.link
        ? h(
            'a',
            { href: s.link, target: '_blank', rel: 'noopener' },
            title,
            icon('link', LINK_ICON)
          )
        : h('span', null, title)
    );
  }

  /**
   * Draws the head of a team: its number, its title, its size with the
   * warning about small teams, its status and its Details button.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {!Array<!Object>} members The members.
   * @param {function()} reload Draws the page again.
   * @return {!Element} The head.
   */
  function teamHead(form, s, members, reload) {
    var alerts = Rules.sizeAlerts(form);
    return h(
      'header',
      { class: 'block-head' },
      h('span', { class: 'team-no' }, 'Team ' + s.number),
      titleOf(form, s),
      h(
        'span',
        { class: 'block-meta' },
        h('span', { class: 'mono' }, s.ref),
        ' · ',
        members.length === 1 ? 'Solo' : members.length + ' members',
        App.sizeAlerts.tag(
          Rules.sizeAlertLevels(alerts),
          Rules.sizeAlertOf(alerts, members.length)
        )
      ),
      h(
        'div',
        { class: 'actions block-actions' },
        R.statusSelect(form, s),
        R.detailsButton(form, s, reload)
      )
    );
  }

  /**
   * Draws the teams, by their number.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The submissions.
   * @param {function()} reload Draws the page again.
   * @return {!Element} The list.
   */
  R.teams = function (form, rows, reload) {
    var sorted = rows.slice().sort(function (a, b) {
      return a.number - b.number;
    });
    return h(
      'div',
      { class: 'team-list' },
      sorted.map(function (s, i) {
        var members = Rules.membersOf(form, s.data);
        return h(
          'article',
          {
            class: 'block team-card ' + (i % 2 ? 'tint-b' : 'tint-a'),
            dataset: { ref: s.ref }
          },
          teamHead(form, s, members, reload),
          memberTable(members)
        );
      })
    );
  };
})(window.App);

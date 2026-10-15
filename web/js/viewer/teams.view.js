/**
 * The teams of a team or task form on the instructor page: the warnings
 * about small teams, then each team as a block with its members in a
 * table. Only the columns the link shows are drawn.
 */
(function (App) {
  'use strict';

  var V = App.viewer;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  /** The size of the link icon beside a title. */
  var LINK_ICON = 15;
  /** The size of the star beside the leader. */
  var LEADER_ICON = 13;

  /**
   * Reads which member columns the link shows.
   *
   * @param {!Object} d The data of the form.
   * @return {{name: boolean, section: boolean, code: boolean,
   *     phone: boolean}} The columns shown.
   */
  function shownColumns(d) {
    var ids = d.columns.map(function (c) {
      return c.id;
    });
    return {
      name: ids.indexOf('name') !== -1,
      section: ids.indexOf('section') !== -1,
      code: ids.indexOf('code') !== -1,
      phone: ids.indexOf('phone') !== -1
    };
  }

  /**
   * Draws the head row of a team table.
   *
   * @param {!Object} show The columns shown.
   * @return {!Element} The row.
   */
  function headRow(show) {
    return h(
      'tr',
      null,
      h('th', null, '#'),
      show.name ? h('th', null, 'Team member') : null,
      show.section ? h('th', null, 'Section') : null,
      show.code ? h('th', null, 'Code') : null,
      show.phone ? h('th', null, 'Phone') : null
    );
  }

  /**
   * Draws the name of a member, with a tag when the member leads.
   *
   * @param {!Object} m The member.
   * @return {!Element} The cell.
   */
  function nameCell(m) {
    return h(
      'td',
      { class: 'nm' },
      V.bdi(m.name),
      m.leader
        ? h('span', { class: 'lead-tag' }, icon('star', LEADER_ICON), 'Leader')
        : null
    );
  }

  /**
   * Draws a member as a row of the team table.
   *
   * @param {!Object} show The columns shown.
   * @param {!Object} m The member.
   * @param {number} k Where the member is in the team, from 0.
   * @return {!Element} The row.
   */
  function memberRow(show, m, k) {
    return h(
      'tr',
      { class: m.leader ? 'leader' : null },
      h('td', { class: 'num' }, String(k + 1)),
      show.name ? nameCell(m) : null,
      show.section
        ? h('td', { dataset: { label: 'Section' } }, m.section || '-')
        : null,
      show.code
        ? h('td', { class: 'mono', dataset: { label: 'Code' } }, m.code)
        : null,
      show.phone
        ? h(
            'td',
            { class: 'mono tel', dataset: { label: 'Phone' } },
            m.phone ? h('a', { href: 'tel:' + m.phone }, m.phone) : '-'
          )
        : null
    );
  }

  /**
   * Draws the project or task of a team, when the link shows it.
   *
   * @param {!Object} d The data of the form.
   * @param {!Object} g The team.
   * @return {!Element} The title.
   */
  function teamTitle(d, g) {
    if (g.title === undefined && g.link === undefined) {
      return h('div', { class: 'block-title' });
    }
    var third = d.form.type === FormType.TASK_SUBMISSION ? 'Task' : 'Project';
    return h(
      'div',
      { class: 'block-side block-title' },
      h('span', { class: 'kicker' }, third),
      g.link
        ? h(
            'a',
            { href: g.link, target: '_blank', rel: 'noopener' },
            g.title || 'Open',
            icon('link', LINK_ICON)
          )
        : h('span', null, g.title || '-')
    );
  }

  /**
   * Draws the block of a team.
   *
   * @param {!Object} d The data of the form.
   * @param {!Object} show The columns shown.
   * @param {!Object} g The team.
   * @param {number} i Where it is on the page.
   * @return {!Element} The block.
   */
  function teamCard(d, show, g, i) {
    return h(
      'article',
      {
        class: 'block team-card ' + (i % 2 ? 'tint-b' : 'tint-a'),
        dataset: { ref: g.ref }
      },
      h(
        'header',
        { class: 'block-head' },
        h('span', { class: 'team-no' }, 'Team ' + g.number),
        teamTitle(d, g),
        h(
          'span',
          { class: 'block-meta' },
          g.members.length === 1 ? 'Solo' : g.members.length + ' members',
          App.sizeAlerts.tag(d.sizeAlerts, g.alert)
        )
      ),
      h(
        'div',
        { class: 'scroll-x' },
        h(
          'table',
          { class: 'mini' },
          h('thead', null, headRow(show)),
          h('tbody', null, g.members.map(memberRow.bind(null, show)))
        )
      )
    );
  }

  /**
   * Draws the teams that hold the search, after the warnings about small
   * teams.
   *
   * @param {!Object} d The data of the form.
   * @return {!Element} The teams.
   */
  V.teams = function (d) {
    var groups = d.groups.filter(V.matches);
    var show = shownColumns(d);
    // The small teams are counted over the whole form, whatever the search
    // shows.
    var warned = App.sizeAlerts.summary(
      d.sizeAlerts,
      d.groups.map(function (g) {
        return { label: 'Team ' + g.number, alert: g.alert };
      })
    );
    return h(
      'div',
      null,
      warned,
      groups.length
        ? h(
            'div',
            { class: 'team-list' },
            groups.map(function (g, i) {
              return teamCard(d, show, g, i);
            })
          )
        : h('div', { class: 'empty' }, 'No teams to show.')
    );
  };
})(window.App);

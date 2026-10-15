/**
 * The warnings about small teams, drawn the same way on the dashboard and on the instructor page.
 * Which levels are on and which level a team falls under come from Rules.sizeAlerts, on the
 * dashboard directly and on the instructor page through the server. This file only draws them.
 */
(function (App) {
  'use strict';

  var ui = App.ui,
    h = ui.h,
    icon = ui.icon;
  var NAME = { critical: 'Critical', warning: 'Warning' };

  /**
   * levels: [{ level, below }], the levels that are on. teams: [{ label, alert }], every team of the form.
   * Returns one line for each level that has teams, or null when no team is small.
   */
  function summary(levels, teams) {
    var lines = (levels || [])
      .map(function (l) {
        var hit = teams.filter(function (t) {
          return t.alert === l.level;
        });
        if (!hit.length) return null;
        return h(
          'p',
          { class: 'size-alert is-' + l.level, name: 'size-alert-' + l.level },
          icon('warn', 18),
          h(
            'span',
            null,
            h('strong', null, NAME[l.level] + ': '),
            (hit.length === 1 ? 'one team has' : hit.length + ' teams have') +
              ' fewer than ' +
              l.below +
              ' people: ' +
              hit
                .map(function (t) {
                  return t.label;
                })
                .join(', ') +
              '.'
          )
        );
      })
      .filter(Boolean);
    return lines.length
      ? h('div', { class: 'size-alerts', role: 'status' }, lines)
      : null;
  }

  /** The mark on the card of a small team, or null for a team that is not small. */
  function tag(levels, alert) {
    var l = (levels || []).filter(function (x) {
      return x.level === alert;
    })[0];
    return l
      ? h(
          'span',
          {
            class: 'size-tag is-' + l.level,
            name: 'size-tag',
            title: 'Fewer than ' + l.below + ' people'
          },
          icon('warn', 13),
          NAME[l.level]
        )
      : null;
  }

  App.sizeAlerts = { summary: summary, tag: tag };
})((window.App = window.App || {}));

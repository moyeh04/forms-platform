/**
 * The warnings about small teams, drawn the same way on the dashboard and
 * on the instructor page. Which levels are on and which level a team falls
 * under come from Rules.sizeAlerts, on the dashboard directly and on the
 * instructor page through the server. This file only draws them.
 */
(function (App) {
  'use strict';

  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  /** The name shown for each level. */
  var NAME = { critical: 'Critical', warning: 'Warning' };

  /** The size of the warning icon in a summary line, in pixels. */
  var LINE_ICON_SIZE = 18;

  /** The size of the warning icon on a team card, in pixels. */
  var TAG_ICON_SIZE = 13;

  /**
   * Writes which teams fall under a level.
   *
   * @param {{level: string, below: number}} l The level.
   * @param {!Array<{label: string}>} hit The teams under it.
   * @return {string} The sentence.
   */
  function sentence(l, hit) {
    var count = hit.length === 1 ? 'one team has' : hit.length + ' teams have';
    var names = hit
      .map(function (t) {
        return t.label;
      })
      .join(', ');
    return count + ' fewer than ' + l.below + ' people: ' + names + '.';
  }

  /**
   * Draws the line of one level.
   *
   * @param {{level: string, below: number}} l The level.
   * @param {!Array<{label: string, alert: string}>} teams Every team.
   * @return {?Element} The line, or null when no team falls under it.
   */
  function levelLine(l, teams) {
    var hit = teams.filter(function (t) {
      return t.alert === l.level;
    });
    if (!hit.length) return null;
    return h(
      'p',
      { class: 'size-alert is-' + l.level, name: 'size-alert-' + l.level },
      icon('warn', LINE_ICON_SIZE),
      h('span', null, h('strong', null, NAME[l.level] + ': '), sentence(l, hit))
    );
  }

  /**
   * Draws one line for each level that has teams.
   *
   * @param {?Array<{level: string, below: number}>} levels The levels
   *     that are on.
   * @param {!Array<{label: string, alert: string}>} teams Every team of
   *     the form.
   * @return {?Element} The lines, or null when no team is small.
   */
  function summary(levels, teams) {
    var lines = (levels || [])
      .map(function (l) {
        return levelLine(l, teams);
      })
      .filter(Boolean);
    return lines.length
      ? h('div', { class: 'size-alerts', role: 'status' }, lines)
      : null;
  }

  /**
   * Draws the mark on the card of a small team.
   *
   * @param {?Array<{level: string, below: number}>} levels The levels
   *     that are on.
   * @param {string} alert The level the team falls under, or ''.
   * @return {?Element} The mark, or null for a team that is not small.
   */
  function tag(levels, alert) {
    var l = (levels || []).filter(function (x) {
      return x.level === alert;
    })[0];
    if (!l) return null;
    return h(
      'span',
      {
        class: 'size-tag is-' + l.level,
        name: 'size-tag',
        title: 'Fewer than ' + l.below + ' people'
      },
      icon('warn', TAG_ICON_SIZE),
      NAME[l.level]
    );
  }

  App.sizeAlerts = { summary: summary, tag: tag };
})(window.App);

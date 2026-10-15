/**
 * The rules of team size: the sizes a form allows, the notes a student sees
 * for a size, and the warnings about small teams.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var textRules = node ? require('./text.js') : root.RulesText;
  var formRules = node ? require('./form.js') : root.RulesForm;

  /** The biggest team when the form does not say. */
  var DEFAULT_MAX_SIZE = 6;

  /** The smallest number a warning level can ask for. */
  var MIN_ALERT_SIZE = 2;

  /** The levels, the stronger first: a team gets the first it is under. */
  var SIZE_ALERT_LEVELS = ['critical', 'warning'];

  /**
   * Reads the submission rules of a form.
   *
   * @param {?Object} form The form.
   * @return {!Object} Its rules, or an empty object.
   */
  function rulesOf(form) {
    var f = form || {};
    return f.rules || {};
  }

  /**
   * Gives the allowed total team size, leader included, from the form rules.
   *
   * @param {?Object} form The form.
   * @return {{min: number, max: number}} The smallest and biggest size.
   */
  function teamSizeRange(form) {
    var ts = rulesOf(form).teamSize || {};
    var min = parseInt(ts.min, 10);
    var max = parseInt(ts.max, 10);
    if (!(min >= 1)) min = 1;
    if (!(max >= min)) max = Math.max(min, DEFAULT_MAX_SIZE);
    return { min: min, max: max };
  }

  /**
   * Gives the note of a range for the number a student picked. {n} in the
   * note becomes the number and {max} the highest allowed.
   *
   * @param {?Object} notice The note, as `{sizes, text: {en, ar}}`.
   * @param {*} size The number picked.
   * @param {number} max The highest number allowed.
   * @param {string} lang The language of the page.
   * @return {string} The note, or '' when that number has none.
   */
  function sizeNotice(notice, size, max, lang) {
    var v = parseInt(size, 10);
    if (!notice || !Array.isArray(notice.sizes)) return '';
    if (notice.sizes.map(Number).indexOf(v) === -1) return '';
    var text = notice.text || {};
    return String(text[lang] || text.en || text.ar || '')
      .replace(/\{n\}/g, String(v))
      .replace(/\{max\}/g, String(max));
  }

  /**
   * Gives the note a student sees after choosing a team size.
   *
   * @param {?Object} form The form.
   * @param {*} size The size chosen.
   * @param {string} lang The language of the page.
   * @return {string} The note, or ''.
   */
  function teamSizeNotice(form, size, lang) {
    var ts = rulesOf(form).teamSize || {};
    return sizeNotice(ts.notice, size, teamSizeRange(form).max, lang);
  }

  /**
   * Gives the note a leader sees for the number of teammates they added to
   * a booking.
   *
   * @param {?Object} form The form.
   * @param {number} count The teammates added.
   * @param {string} lang The language of the page.
   * @return {string} The note, or ''.
   */
  function teammateNotice(form, count, lang) {
    var mf = formRules.fieldByRole(form, 'members');
    return mf ? sizeNotice(mf.notice, count, mf.max, lang) : '';
  }

  /**
   * Gives the highest number a level can ask for: a team of the biggest
   * size is never small.
   *
   * @param {?Object} form The form.
   * @return {number} The number.
   */
  function sizeAlertCeiling(form) {
    return Math.max(teamSizeRange(form).max, MIN_ALERT_SIZE);
  }

  /**
   * Gives the numbers a warning level can ask for, so the dashboard bounds
   * its inputs by the same rule as the save.
   *
   * @param {?Object} form The form.
   * @return {{min: number, max: number}} The lowest and the highest.
   */
  function sizeAlertBounds(form) {
    return { min: MIN_ALERT_SIZE, max: sizeAlertCeiling(form) };
  }

  /**
   * Gives the warnings about small teams of a form. A level is `{on,
   * below}` and marks the teams with fewer people than `below`. A level
   * that was never set starts from the biggest team size: about half of it,
   * and one person under it. Whether an instructor sees them is a setting
   * of each instructor link, not of the form.
   *
   * @param {?Object} form The form.
   * @return {{critical: !Object, warning: !Object}} The levels.
   */
  function sizeAlerts(form) {
    var raw = rulesOf(form).sizeAlerts || {};
    var max = sizeAlertCeiling(form);
    var half = Math.max(MIN_ALERT_SIZE, Math.ceil(max / 2));
    var start = {
      critical: half,
      warning: Math.min(max, Math.max(max - 1, half + 1))
    };
    var out = {};
    SIZE_ALERT_LEVELS.forEach(function (k) {
      var level = raw[k] || {};
      var n = parseInt(level.below, 10);
      out[k] = {
        on: level.on === true,
        below: n >= MIN_ALERT_SIZE ? Math.min(n, max) : start[k]
      };
    });
    return out;
  }

  /**
   * Says why the warnings a form was given cannot be saved. 'range': the
   * number of a level that is on is not a whole number from 2 to the
   * biggest team size. 'order': the warning is not for a higher number
   * than the critical one, so no team would get it.
   *
   * @param {?Object} form The form.
   * @return {?Object} `{level, error, min, max}`, or null when they can.
   */
  function sizeAlertsProblem(form) {
    var raw = rulesOf(form).sizeAlerts || {};
    var max = sizeAlertCeiling(form);
    var on = SIZE_ALERT_LEVELS.filter(function (k) {
      var level = raw[k] || {};
      return level.on === true;
    });
    var bad = on.filter(function (k) {
      var s = String(raw[k].below == null ? '' : raw[k].below).trim();
      return !/^\d+$/.test(s) || +s < MIN_ALERT_SIZE || +s > max;
    })[0];
    var min = MIN_ALERT_SIZE;
    if (bad) return { level: bad, error: 'range', min: min, max: max };
    var both = on.length === SIZE_ALERT_LEVELS.length;
    if (both && +raw.warning.below <= +raw.critical.below) {
      return { level: 'warning', error: 'order', min: min, max: max };
    }
    return null;
  }

  /**
   * Lists the levels that are on, the stronger one first.
   *
   * @param {!Object} alerts The warnings, as sizeAlerts gives them.
   * @return {!Array<{level: string, below: number}>} The levels.
   */
  function sizeAlertLevels(alerts) {
    return SIZE_ALERT_LEVELS.filter(function (k) {
      var level = alerts[k] || {};
      return level.on;
    }).map(function (k) {
      return { level: k, below: alerts[k].below };
    });
  }

  /**
   * Gives the level a team falls under.
   *
   * @param {!Object} alerts The warnings, as sizeAlerts gives them.
   * @param {number} count The people on the team.
   * @return {string} The level, or '' when the team is not small.
   */
  function sizeAlertOf(alerts, count) {
    var hit = sizeAlertLevels(alerts).filter(function (l) {
      return count < l.below;
    })[0];
    return hit ? hit.level : '';
  }

  /**
   * Checks a team size field against the sizes the form allows.
   *
   * @param {*} raw The typed size.
   * @param {?Object} form The form.
   * @return {!Object} `{ok: true, value}` with the size as text, or
   *     `{ok: false, error, params}`.
   */
  function validateTeamSize(raw, form) {
    var r = teamSizeRange(form);
    var s = textRules.latinDigits(raw).trim();
    var n = /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
    if (Number.isNaN(n) || n < r.min || n > r.max) {
      return {
        ok: false,
        error: 'invalid_team_size',
        params: { min: r.min, max: r.max }
      };
    }
    return { ok: true, value: String(n) };
  }

  var api = {
    teamSizeRange: teamSizeRange,
    sizeNotice: sizeNotice,
    teamSizeNotice: teamSizeNotice,
    teammateNotice: teammateNotice,
    sizeAlerts: sizeAlerts,
    sizeAlertsProblem: sizeAlertsProblem,
    sizeAlertBounds: sizeAlertBounds,
    sizeAlertLevels: sizeAlertLevels,
    sizeAlertOf: sizeAlertOf,
    validateTeamSize: validateTeamSize
  };
  if (node) module.exports = api;
  root.RulesTeamSize = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

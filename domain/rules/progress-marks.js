/**
 * The marks of a team on the milestones of its form: the state and two
 * notes of each, what a change may do, the counts a board shows, and what a
 * team or an instructor link may see.
 *
 * The marks of a team are one object, by milestone id:
 * `{ <id>: { s, t, p, at, by } }`. `s` is a ProgressState, `t` the note for
 * the team, `p` the private note, `at` when the state last changed and `by`
 * who changed it ("a" for the admin, "c:<link id>" for a link). A milestone
 * with no mark is Not yet with no notes.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var enums = node ? require('../enums.js') : root;
  var ProgressState = enums.ProgressState;
  var milestonesOf = (node ? require('./progress.js') : root.RulesProgress)
    .milestonesOf;

  /** The longest note, for the team or private. */
  var PROGRESS_NOTE_MAX = 500;

  /** The note fields of a change, by the field of the mark they set. */
  var NOTE_FIELDS = { t: 'teamNote', p: 'privateNote' };

  /**
   * Whether a value is one of the members of an enum.
   *
   * @param {!Object} members The enum.
   * @param {*} v The value.
   * @return {boolean} True when it is.
   */
  function isMember(members, v) {
    return Object.keys(members).some(function (k) {
      return members[k] === v;
    });
  }

  /**
   * Reads the marks of a team as the sheet keeps them.
   *
   * @param {*} cell The progress cell: JSON, an object, or empty.
   * @return {!Object} The marks, by milestone id.
   */
  function readProgress(cell) {
    var v;
    if (cell && typeof cell === 'object') return cell;
    try {
      v = JSON.parse(String(cell || '{}'));
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (_e) {
      return {};
    }
  }

  /**
   * Gives the mark of a team on a milestone.
   *
   * @param {?Object} progress The marks of the team.
   * @param {string} id The milestone.
   * @return {{s: string, t: string, p: string, at: string, by: string}} The
   *     mark; Not yet with empty notes when it has none.
   */
  function markOf(progress, id) {
    var m = progress?.[id] || {};
    return {
      s: isMember(ProgressState, m.s) ? m.s : ProgressState.NOT_YET,
      t: m.t || '',
      p: m.p || '',
      at: m.at || '',
      by: m.by || ''
    };
  }

  /**
   * Says why a change to a mark is refused.
   *
   * @param {?Object} form The form.
   * @param {string} id The milestone.
   * @param {!Object} change `state`, `teamNote` and `privateNote`, each
   *     optional.
   * @return {string} `bad_milestone`, `bad_state`, `note_too_long`, or ''.
   */
  function markProblem(form, id, change) {
    var known = milestonesOf(form).some(function (m) {
      return m.id === id;
    });
    if (!known) return 'bad_milestone';
    if (change.state !== undefined && !isMember(ProgressState, change.state)) {
      return 'bad_state';
    }
    var long = Object.keys(NOTE_FIELDS).some(function (k) {
      var v = change[NOTE_FIELDS[k]];
      return v !== undefined && String(v).trim().length > PROGRESS_NOTE_MAX;
    });
    return long ? 'note_too_long' : '';
  }

  /**
   * Whether a change was made on a mark that changed since the page read
   * it: the time of its state differs from the one the page saw.
   *
   * @param {?Object} progress The marks of the team now.
   * @param {string} id The milestone.
   * @param {*} baseAt The time the page saw, or nothing.
   * @return {boolean} True when the page is behind.
   */
  function markStale(progress, id, baseAt) {
    return markOf(progress, id).at !== String(baseAt || '');
  }

  /**
   * Applies a change to the marks of a team. The time and who change only
   * with the state; a mark back to Not yet with no notes is dropped.
   *
   * @param {?Object} progress The marks of the team.
   * @param {string} id The milestone.
   * @param {!Object} change `state`, `teamNote` and `privateNote`.
   * @param {{at: string, by: string}} stamp When, as ISO text, and who
   *     marks.
   * @return {!Object} The new marks.
   */
  function applyMark(progress, id, change, stamp) {
    var out = Object.assign({}, progress || {});
    var m = markOf(out, id);
    if (change.state !== undefined && change.state !== m.s) {
      m.s = change.state;
      m.at = stamp.at;
      m.by = stamp.by;
    }
    Object.keys(NOTE_FIELDS).forEach(function (k) {
      var v = change[NOTE_FIELDS[k]];
      if (v !== undefined) m[k] = String(v).trim();
    });
    if (m.s === ProgressState.NOT_YET && !m.t && !m.p) delete out[id];
    else out[id] = m;
    return out;
  }

  /**
   * Counts the milestones of a form a team has submitted and discussed.
   *
   * @param {?Object} form The form.
   * @param {?Object} progress The marks of the team.
   * @return {{discussed: number, submitted: number, total: number}} The
   *     counts; a discussed milestone is not counted as submitted.
   */
  function progressCount(form, progress) {
    var out = { discussed: 0, submitted: 0, total: 0 };
    milestonesOf(form).forEach(function (m) {
      var s = markOf(progress, m.id).s;
      out.total++;
      if (s === ProgressState.DISCUSSED) out.discussed++;
      if (s === ProgressState.SUBMITTED) out.submitted++;
    });
    return out;
  }

  /**
   * Whether a team has a mark on a milestone: a state or a note.
   *
   * @param {?Object} progress The marks of the team.
   * @param {string} id The milestone.
   * @return {boolean} True when it has one.
   */
  function hasMark(progress, id) {
    var m = markOf(progress, id);
    return m.s !== ProgressState.NOT_YET || !!m.t || !!m.p;
  }

  /**
   * Counts, for each milestone id, the teams with a mark on it.
   *
   * @param {!Array<?Object>} teams The marks of each team.
   * @return {!Object<string, number>} The counts, by id.
   */
  function markCounts(teams) {
    var out = {};
    teams.forEach(function (progress) {
      Object.keys(progress || {}).forEach(function (id) {
        if (hasMark(progress, id)) out[id] = (out[id] || 0) + 1;
      });
    });
    return out;
  }

  /**
   * Gives a team its own progress: each milestone with its state and the
   * note for the team, never the private note or who marked.
   *
   * @param {?Object} form The form.
   * @param {?Object} progress The marks of the team.
   * @return {!Array<{id: string, label: !Object, state: string,
   *     note: string}>} One line for each milestone.
   */
  function studentProgress(form, progress) {
    return milestonesOf(form).map(function (m) {
      var mark = markOf(progress, m.id);
      return { id: m.id, label: m.label, state: mark.s, note: mark.t };
    });
  }

  /**
   * Gives an instructor link the marks of a team on the milestones of the
   * form, without who marked.
   *
   * @param {?Object} form The form.
   * @param {?Object} progress The marks of the team.
   * @return {!Object} The marks, by milestone id: `s`, `t`, `p` and `at`.
   */
  function linkProgress(form, progress) {
    var out = {};
    milestonesOf(form).forEach(function (m) {
      if (!hasMark(progress, m.id)) return;
      var mark = markOf(progress, m.id);
      out[m.id] = { s: mark.s, t: mark.t, p: mark.p, at: mark.at };
    });
    return out;
  }

  var api = {
    PROGRESS_NOTE_MAX: PROGRESS_NOTE_MAX,
    readProgress: readProgress,
    markOf: markOf,
    markProblem: markProblem,
    markStale: markStale,
    applyMark: applyMark,
    progressCount: progressCount,
    hasMark: hasMark,
    markCounts: markCounts,
    studentProgress: studentProgress,
    linkProgress: linkProgress
  };
  if (node) module.exports = api;
  root.RulesProgressMarks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

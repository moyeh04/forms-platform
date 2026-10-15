/**
 * The rules of the milestones of a form: a team registration copies them
 * from a milestones list into `form.progress` (`{from, milestones, students}`),
 * keeps its copy until the admin updates it, and can show the teams their
 * own progress. The marks of the teams are in progress-marks.js.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var enums = node ? require('../enums.js') : root;
  var FormType = enums.FormType;

  /** The longest milestone id. */
  var MILESTONE_ID_MAX = 40;

  /** The longest milestone name. */
  var MILESTONE_NAME_MAX = 120;

  /**
   * Gives the milestones of a form. Only a team registration has them.
   *
   * @param {?Object} form The form.
   * @return {!Array<{id: string, label: !Object}>} The milestones, in order.
   */
  function milestonesOf(form) {
    if (!form || form.type !== FormType.TEAM_REGISTRATION) return [];
    return form.progress?.milestones || [];
  }

  /**
   * Whether a form follows the progress of its teams.
   *
   * @param {?Object} form The form.
   * @return {boolean} True when it has milestones.
   */
  function progressOn(form) {
    return milestonesOf(form).length > 0;
  }

  /**
   * Whether the teams of a form see their own progress.
   *
   * @param {?Object} form The form.
   * @return {boolean} True when progress is on and shown to students.
   */
  function progressForStudents(form) {
    return progressOn(form) && form.progress.students !== false;
  }

  /**
   * Turns the choices of a milestones list into milestones.
   *
   * @param {?Array<!Object>} values The list: `{value, label}` each.
   * @return {!Array<{id: string, label: !Object}>} The milestones.
   */
  function milestonesFromList(values) {
    return (values || []).map(function (o) {
      var label = o.label || {};
      var en = String(label.en || o.value);
      return {
        id: String(o.value),
        label: { en: en, ar: String(label.ar || en) }
      };
    });
  }

  /**
   * Cleans one milestone of a form as it is saved.
   *
   * @param {*} m The milestone as sent.
   * @return {?{id: string, label: !Object}} The milestone, or null when it
   *     has no id or no English name.
   */
  function cleanMilestone(m) {
    var id = String(m?.id || '').trim();
    var label = m?.label || {};
    var en = String(label.en || '').trim();
    if (!id || id.length > MILESTONE_ID_MAX || !en) return null;
    if (en.length > MILESTONE_NAME_MAX) return null;
    var ar = String(label.ar || '').trim() || en;
    return { id: id, label: { en: en, ar: ar.slice(0, MILESTONE_NAME_MAX) } };
  }

  /**
   * Cleans `form.progress` as it is saved.
   *
   * @param {*} raw The progress as sent.
   * @return {{ok: boolean, value: ?Object, error: (string|undefined)}} The
   *     clean progress, null when it is off (no milestones), or the error
   *     `bad_progress`.
   */
  function cleanProgress(raw) {
    if (!Array.isArray(raw?.milestones) || !raw.milestones.length) {
      return { ok: true, value: null };
    }
    var milestones = raw.milestones.map(cleanMilestone);
    var ids = milestones.map(function (m) {
      return m?.id;
    });
    var bad = milestones.some(function (m, i) {
      return !m || ids.indexOf(m.id) !== i;
    });
    if (bad) return { ok: false, value: null, error: 'bad_progress' };
    return {
      ok: true,
      value: {
        from: String(raw.from || ''),
        milestones: milestones,
        students: raw.students !== false
      }
    };
  }

  /**
   * Gives the ids of milestones.
   *
   * @param {!Array<!Object>} a The milestones.
   * @return {!Array<string>} Their ids, in order.
   */
  function idsOf(a) {
    return a.map(function (m) {
      return m.id;
    });
  }

  /**
   * Gives the ids of milestones that are also in both of two id lists.
   *
   * @param {!Array<!Object>} a The milestones.
   * @param {!Array<string>} one The ids of one copy.
   * @param {!Array<string>} two The ids of the other.
   * @return {!Array<string>} The ids in both, in the order of `a`.
   */
  function keptIds(a, one, two) {
    return idsOf(a).filter(function (id) {
      return one.indexOf(id) !== -1 && two.indexOf(id) !== -1;
    });
  }

  /**
   * Says how the milestones of a form differ from its list now.
   *
   * @param {!Array<!Object>} copy The milestones of the form.
   * @param {!Array<!Object>} list The milestones the list gives.
   * @return {{added: !Array<!Object>, removed: !Array<!Object>,
   *     renamed: !Array<!Object>, moved: boolean, same: boolean}} The
   *     milestones added, removed and renamed (as the list has them), and
   *     whether the order changed.
   */
  function milestonesDiff(copy, list) {
    var copyIds = idsOf(copy);
    var listIds = idsOf(list);
    var out = {
      added: list.filter(function (m) {
        return copyIds.indexOf(m.id) === -1;
      }),
      removed: copy.filter(function (m) {
        return listIds.indexOf(m.id) === -1;
      }),
      renamed: list.filter(function (m) {
        var i = copyIds.indexOf(m.id);
        return (
          i !== -1 && JSON.stringify(copy[i].label) !== JSON.stringify(m.label)
        );
      })
    };
    out.moved =
      keptIds(copy, copyIds, listIds).join() !==
      keptIds(list, copyIds, listIds).join();
    out.same =
      !out.added.length &&
      !out.removed.length &&
      !out.renamed.length &&
      !out.moved;
    return out;
  }

  /**
   * Lists the milestones a change takes off a form while teams have marks
   * on them: the marks stay in the sheet but are no longer shown.
   *
   * @param {!Array<!Object>} before The milestones as saved.
   * @param {!Array<!Object>} after The milestones after the change.
   * @param {!Object<string, number>} counts The teams with marks, by id.
   * @return {!Array<{id: string, label: !Object, teams: number}>} Each
   *     milestone taken off that has marks, with how many teams have them.
   */
  function marksHidden(before, after, counts) {
    var kept = idsOf(after);
    return before
      .filter(function (m) {
        return kept.indexOf(m.id) === -1 && counts[m.id] > 0;
      })
      .map(function (m) {
        return { id: m.id, label: m.label, teams: counts[m.id] };
      });
  }

  var api = {
    milestonesOf: milestonesOf,
    progressOn: progressOn,
    progressForStudents: progressForStudents,
    milestonesFromList: milestonesFromList,
    cleanProgress: cleanProgress,
    milestonesDiff: milestonesDiff,
    marksHidden: marksHidden
  };
  if (node) module.exports = api;
  root.RulesProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

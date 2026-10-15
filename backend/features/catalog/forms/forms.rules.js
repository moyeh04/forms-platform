/**
 * The submission rules and the small-team notice of a form, cleaned to what
 * is allowed.
 */

var FormsRules = (function () {
  /** The largest team a form may allow. */
  var MAX_TEAM_ = 20;

  /** The base of the numbers the page sends. */
  var DECIMAL_ = 10;

  /**
   * Keeps the values of the rules that limit a form to some list values as
   * clean text.
   *
   * @param {!Object} merged The rules, changed in place.
   */
  function cleanLists_(merged) {
    FormsPublic.LIMITED_LISTS.forEach(function (list) {
      if (merged[list] === undefined) return;
      merged[list] = Array.isArray(merged[list])
        ? merged[list].map(String).filter(Boolean)
        : [];
    });
  }

  /**
   * Checks the team size range and cleans its small-team notice; a notice
   * not in the patch stays as it was.
   *
   * @param {!Object} merged The rules, changed in place.
   * @param {?Object} current The rules before the change.
   * @param {?Object} next The rules the patch sends.
   * @throws {ApiError} `bad_team_size`.
   */
  function cleanTeamSize_(merged, current, next) {
    var min = parseInt(merged.teamSize?.min, DECIMAL_);
    var max = parseInt(merged.teamSize?.max, DECIMAL_);
    if (!(min >= 1) || !(max >= min) || max > MAX_TEAM_) {
      ApiError.fail(
        'bad_team_size',
        'Team size must be between 1 and ' +
          MAX_TEAM_ +
          ', and the maximum cannot be lower than the minimum.'
      );
    }
    merged.teamSize = { min: min, max: max };
    var notice =
      next?.teamSize && next.teamSize.notice !== undefined
        ? next.teamSize.notice
        : current?.teamSize?.notice;
    if (notice) {
      merged.teamSize.notice = normalizeSizeNotice_(notice, min, max);
    }
  }

  /**
   * Checks and cleans the warnings about small teams.
   *
   * @param {!Object} merged The rules, changed in place.
   * @throws {ApiError} `bad_size_alerts`.
   */
  function cleanSizeAlerts_(merged) {
    var stop = Rules.sizeAlertsProblem({ rules: merged });
    if (stop) {
      ApiError.fail(
        'bad_size_alerts',
        stop.error === 'order'
          ? 'The warning must be for a higher number than the critical ' +
              'warning, or no team gets it.'
          : 'A warning about small teams needs a number from ' +
              stop.min +
              ' to ' +
              stop.max +
              '.',
        { level: stop.level, error: stop.error }
      );
    }
    merged.sizeAlerts = Rules.sizeAlerts({ rules: merged });
  }

  /**
   * Merges new rule settings over the old ones and checks the team size
   * range and the warnings about small teams.
   *
   * @param {?Object} current The rules before the change.
   * @param {?Object} next The rules the patch sends.
   * @return {!Object} The cleaned rules.
   */
  function normalizeRules_(current, next) {
    var merged = Object.assign({}, current || {}, next || {});
    cleanLists_(merged);
    if (merged.teamSize !== undefined) cleanTeamSize_(merged, current, next);
    if (merged.sizeAlerts !== undefined) cleanSizeAlerts_(merged);
    return merged;
  }

  /**
   * Keeps only whole sizes inside the range, and trimmed English and Arabic
   * text.
   *
   * @param {!Object} n The notice: `sizes` and `text`.
   * @param {number} min The smallest team size.
   * @param {number} max The largest team size.
   * @return {{sizes: !Array<number>, text: {en: string, ar: string}}} The
   *     cleaned notice.
   */
  function normalizeSizeNotice_(n, min, max) {
    var sizes = [];
    (Array.isArray(n.sizes) ? n.sizes : []).forEach(function (x) {
      var v = parseInt(x, DECIMAL_);
      if (v >= min && v <= max && sizes.indexOf(v) === -1) sizes.push(v);
    });
    sizes.sort(function (a, b) {
      return a - b;
    });
    var text = n.text || {};
    return {
      sizes: sizes,
      text: {
        en: String(text.en || '').trim(),
        ar: String(text.ar || '').trim()
      }
    };
  }

  /**
   * Checks and cleans the milestones a form copied, `form.progress`. Only a
   * team registration follows the progress of its teams.
   *
   * @param {!Object} form The form.
   * @param {*} next The progress the patch sends.
   * @return {?Object} The cleaned progress, or null when it is off.
   * @throws {ApiError} `bad_progress`.
   */
  function normalizeProgress_(form, next) {
    if (form.type !== FormType.TEAM_REGISTRATION) return null;
    var out = Rules.cleanProgress(next);
    if (!out.ok) {
      ApiError.fail(
        'bad_progress',
        'Each milestone needs an English name, and no milestone may be in' +
          ' the list twice.'
      );
    }
    return out.value;
  }

  return {
    normalizeRules: normalizeRules_,
    normalizeSizeNotice: normalizeSizeNotice_,
    normalizeProgress: normalizeProgress_
  };
})();

/**
 * The submission rules and the small-team notice of a form, cleaned to what is
 * allowed.
 */

/** Merges new rule settings over the old ones and checks the team size range and the warnings about small teams. */
function normalizeRules_(current, next) {
  var merged = Object.assign({}, current || {}, next || {});
  LIMITED_LISTS_.forEach(function (list) {
    if (merged[list] !== undefined)
      merged[list] = Array.isArray(merged[list])
        ? merged[list].map(String).filter(Boolean)
        : [];
  });
  if (merged.teamSize !== undefined) {
    var min = parseInt(merged.teamSize && merged.teamSize.min, 10);
    var max = parseInt(merged.teamSize && merged.teamSize.max, 10);
    if (!(min >= 1) || !(max >= min) || max > 20) {
      fail(
        'bad_team_size',
        'Team size must be between 1 and 20, and the maximum cannot be lower than the minimum.'
      );
    }
    merged.teamSize = { min: min, max: max };
    var notice =
      next && next.teamSize && next.teamSize.notice !== undefined
        ? next.teamSize.notice
        : current && current.teamSize && current.teamSize.notice;
    if (notice) merged.teamSize.notice = normalizeSizeNotice_(notice, min, max);
  }
  if (merged.sizeAlerts !== undefined) {
    var stop = Rules.sizeAlertsProblem({ rules: merged });
    if (stop) {
      fail(
        'bad_size_alerts',
        stop.error === 'order'
          ? 'The warning must be for a higher number than the critical warning, or no team gets it.'
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
  return merged;
}

/** Keeps only whole sizes inside the range, and trimmed English and Arabic text. */
function normalizeSizeNotice_(n, min, max) {
  var sizes = [];
  (Array.isArray(n.sizes) ? n.sizes : []).forEach(function (x) {
    var v = parseInt(x, 10);
    if (v >= min && v <= max && sizes.indexOf(v) === -1) sizes.push(v);
  });
  sizes.sort(function (a, b) {
    return a - b;
  });
  var text = n.text || {};
  return {
    sizes: sizes,
    text: { en: String(text.en || '').trim(), ar: String(text.ar || '').trim() }
  };
}

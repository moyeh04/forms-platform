/**
 * The warnings about small teams in the settings of a form: a critical one
 * and a normal one, each with its own switch and number. Whether an
 * instructor sees them is set on each instructor link.
 */
(function (App) {
  'use strict';

  var ui = App.ui,
    h = ui.h,
    A = App.admin;

  /** The words of each warning level. */
  var TEXT = {
    critical: {
      name: 'The critical warning',
      check: 'Critical warning for very small teams',
      field: 'Critical when a team has fewer people than'
    },
    warning: {
      name: 'The warning',
      check: 'Warning for small teams',
      field: 'Warning when a team has fewer people than'
    }
  };

  /** The levels the rules know, in their order, each with its words. */
  var LEVELS = Rules.sizeAlertLevelIds().map(function (id) {
    return Object.assign({ id: id }, TEXT[id]);
  });

  /**
   * Names the team sizes from a to b: "1", "1 or 2", "3 to 5".
   *
   * @param {number} a The smallest.
   * @param {number} b The largest.
   * @return {string} The sizes in words.
   */
  function sizes(a, b) {
    if (a === b) return String(a);
    return b === a + 1 ? a + ' or ' + b : a + ' to ' + b;
  }

  /**
   * Says why the warnings cannot be saved.
   *
   * @param {!Object} stop The problem: `level`, `error`, `min`, `max`.
   * @return {string} The reason.
   */
  function reason(stop) {
    var level = LEVELS.filter(function (l) {
      return l.id === stop.level;
    })[0];
    if (stop.error === 'order') {
      return (
        'The warning must be for a higher number than the critical' +
        ' warning, or no team gets it.'
      );
    }
    return (
      level.name +
      ' needs a whole number from ' +
      stop.min +
      ' to ' +
      stop.max +
      '.'
    );
  }

  /**
   * Draws the switch and the number of one level.
   *
   * @param {!Object} alerts The warnings of the form, changed in place.
   * @param {!Object} l The level, from LEVELS.
   * @param {function()} paint Draws the warnings again.
   * @return {!Object} The row: `id`, `input`, `error`, `sub`, `node`.
   */
  function alertRow(alerts, l, paint) {
    var input = A.number(
      alerts[l.id].below,
      function (v) {
        var s = String(v).trim();
        // A number is kept as a number. Anything else stays as typed, so
        // the save is refused with the reason.
        alerts[l.id].below = /^\d+$/.test(s) ? parseInt(s, 10) : s;
        paint();
      },
      {
        name: l.id + 'Below',
        'aria-describedby': 'size-alert-' + l.id + '-err'
      }
    );
    var error = h('p', {
      class: 'error',
      id: 'size-alert-' + l.id + '-err',
      role: 'alert'
    });
    var sub = h(
      'div',
      { class: 'sub-setting' },
      A.field(l.field, input),
      error
    );
    var check = A.check(
      l.check,
      alerts[l.id].on,
      function (v) {
        alerts[l.id].on = v;
        paint();
      },
      { name: l.id + 'Alert' }
    );
    return {
      id: l.id,
      input: input,
      error: error,
      sub: sub,
      node: h('div', null, check, sub)
    };
  }

  /**
   * Says in plain words which team sizes get which level.
   *
   * @param {!Object} form The form.
   * @param {!Object} alerts Its warnings.
   * @return {string} The words; '' while a number is refused or no level
   *     is on.
   */
  function words(form, alerts) {
    if (Rules.sizeAlertsProblem(form)) return '';
    var from = 1;
    return Rules.sizeAlertLevels(alerts)
      .map(function (x) {
        var text =
          (x.level === 'critical' ? 'Critical' : 'Warning') +
          ': teams of ' +
          sizes(from, x.below - 1) +
          '.';
        from = x.below;
        return text;
      })
      .join(' ');
  }

  /**
   * Draws the rows and the preview again: which rows are open, the numbers
   * allowed, and the reason a number is refused.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The rows, from alertRow.
   * @param {!Element} preview The plain words.
   */
  function paintAlerts(form, rows, preview) {
    var alerts = form.rules.sizeAlerts;
    var stop = Rules.sizeAlertsProblem(form);
    var bounds = Rules.sizeAlertBounds(form);
    rows.forEach(function (r) {
      r.sub.hidden = !alerts[r.id].on;
      r.input.min = String(bounds.min);
      r.input.max = String(bounds.max);
      r.error.textContent = stop && stop.level === r.id ? reason(stop) : '';
    });
    preview.textContent = words(form, alerts);
    preview.hidden = !preview.textContent;
  }

  /**
   * Says why the warnings of a form cannot be saved.
   *
   * @param {!Object} form The form.
   * @return {string} The reason, or ''.
   */
  function problemOf(form) {
    var stop = Rules.sizeAlertsProblem(form);
    return stop ? reason(stop) : '';
  }

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} form The form.
   * @return {string} Which sizes get which level, or why there is none.
   */
  function summaryOf(form) {
    var alerts = form.rules.sizeAlerts;
    return Rules.sizeAlertLevels(alerts).length
      ? words(form, alerts) || 'A number needs fixing'
      : 'Off';
  }

  /**
   * Draws the warnings of a form. form.rules.sizeAlerts is filled in and
   * changed in place.
   *
   * @param {!Object} form The form being edited.
   * @return {!Object} `node`; `refresh()` draws it again after the team
   *     size range changed; `problem()` is the reason the warnings cannot
   *     be saved, or ''; `summary()` is the folded line of its panel.
   */
  A.sizeAlerts = function (form) {
    var alerts = Rules.sizeAlerts(form);
    form.rules.sizeAlerts = alerts;
    var preview = h('p', {
      class: 'muted-note',
      name: 'size-alerts-preview',
      'aria-live': 'polite'
    });
    var rows = LEVELS.map(function (l) {
      return alertRow(alerts, l, paint);
    });

    /** Draws the warnings again. */
    function paint() {
      paintAlerts(form, rows, preview);
    }
    paint();

    return {
      node: h(
        'div',
        { class: 'size-alert-settings' },
        rows.map(function (r) {
          return r.node;
        }),
        preview
      ),
      refresh: paint,
      problem: problemOf.bind(null, form),
      summary: summaryOf.bind(null, form)
    };
  };
})(window.App);

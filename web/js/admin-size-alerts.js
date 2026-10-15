/**
 * The warnings about small teams in the settings of a form: a critical one and a normal one, each
 * with its own switch and number. Whether an instructor sees them is set on each instructor link.
 */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, A = App.admin;

  var LEVELS = [
    { id: 'critical', name: 'The critical warning', check: 'Critical warning for very small teams', field: 'Critical when a team has fewer people than' },
    { id: 'warning', name: 'The warning', check: 'Warning for small teams', field: 'Warning when a team has fewer people than' }
  ];

  /** "1", "1 or 2", "3 to 5": the team sizes from a to b. */
  function sizes(a, b) { return a === b ? String(a) : b === a + 1 ? a + ' or ' + b : a + ' to ' + b; }

  /**
   * form: the form being edited. form.rules.sizeAlerts is filled in and changed in place.
   * Returns { node, refresh(), problem(), summary() }: refresh() draws it again after the team size
   * range changed, problem() is the reason the warnings cannot be saved, or '', and summary() is the
   * folded line of its panel.
   */
  A.sizeAlerts = function (form) {
    var alerts = form.rules.sizeAlerts = Rules.sizeAlerts(form);

    var reason = function (stop) {
      var level = LEVELS.filter(function (l) { return l.id === stop.level; })[0];
      return stop.error === 'order'
        ? 'The warning must be for a higher number than the critical warning, or no team gets it.'
        : level.name + ' needs a whole number from ' + stop.min + ' to ' + stop.max + '.';
    };

    var rows = LEVELS.map(function (l) {
      var input = A.number(alerts[l.id].below, function (v) {
        var s = String(v).trim();
        // A number is kept as a number. Anything else stays as typed, so the save is refused with the reason.
        alerts[l.id].below = /^\d+$/.test(s) ? parseInt(s, 10) : s;
        paint();
      }, { name: l.id + 'Below', min: '2', 'aria-describedby': 'size-alert-' + l.id + '-err' });
      var error = h('p', { class: 'error', id: 'size-alert-' + l.id + '-err', role: 'alert' });
      var sub = h('div', { class: 'sub-setting' }, A.field(l.field, input), error);
      var check = A.check(l.check, alerts[l.id].on, function (v) { alerts[l.id].on = v; paint(); }, false, l.id + 'Alert');
      return { id: l.id, input: input, error: error, sub: sub, node: h('div', null, check, sub) };
    });

    var preview = h('p', { class: 'muted-note', name: 'size-alerts-preview', 'aria-live': 'polite' });

    /** In plain words, which team sizes get which level; '' while a number is refused or no level is on. */
    var words = function () {
      if (Rules.sizeAlertsProblem(form)) return '';
      var from = 1;
      return Rules.sizeAlertLevels(alerts).map(function (x) {
        var text = (x.level === 'critical' ? 'Critical' : 'Warning') + ': teams of ' + sizes(from, x.below - 1) + '.';
        from = x.below;
        return text;
      }).join(' ');
    };

    var paint = function () {
      var stop = Rules.sizeAlertsProblem(form);
      rows.forEach(function (r) {
        r.sub.hidden = !alerts[r.id].on;
        r.input.max = String(stop ? stop.max : Math.max(Rules.teamSizeRange(form).max, 2));
        r.error.textContent = stop && stop.level === r.id ? reason(stop) : '';
      });
      preview.textContent = words();
      preview.hidden = !preview.textContent;
    };
    paint();

    return {
      node: h('div', { class: 'size-alert-settings' }, rows.map(function (r) { return r.node; }), preview),
      refresh: paint,
      problem: function () { var stop = Rules.sizeAlertsProblem(form); return stop ? reason(stop) : ''; },
      summary: function () { return Rules.sizeAlertLevels(alerts).length ? words() || 'A number needs fixing' : 'Off'; }
    };
  };
})(window.App);

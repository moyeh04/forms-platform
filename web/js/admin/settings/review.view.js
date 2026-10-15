/**
 * The Review steps panel of a form: the steps reviewers mark for each
 * registration, and for a WhatsApp registration, matching to pasted
 * requests.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  /**
   * Draws one step: its names in both languages and Remove.
   *
   * @param {!Object} r The panel: `f` and `paint()`.
   * @param {!Object} step The step.
   * @param {number} i Its place.
   * @return {!Element} The row.
   */
  function stepRow(r, step, i) {
    return h(
      'div',
      { class: 'row', dataset: { step: step.id } },
      A.field(
        'Step ' + (i + 1) + ' name (English)',
        A.text(step.label.en, function (v) {
          step.label.en = v;
        })
      ),
      A.field(
        'Name (Arabic)',
        A.text(
          step.label.ar,
          function (v) {
            step.label.ar = v;
          },
          { dir: 'rtl', lang: 'ar' }
        )
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet sm',
          onclick: function () {
            r.f.review.steps.splice(i, 1);
            r.paint();
          }
        },
        icon('trash', A.ICON_SIZE.LINE),
        'Remove'
      )
    );
  }

  /**
   * Draws the steps again.
   *
   * @param {!Object} r The panel: `f` and `box`.
   */
  function paint(r) {
    ui.clear(r.box);
    r.f.review.steps.forEach(function (step, i) {
      r.box.appendChild(stepRow(r, step, i));
    });
  }

  /**
   * Adds a step at the end, with an id no other step has.
   *
   * @param {!Array<!Object>} steps The steps, changed in place.
   */
  function addStep(steps) {
    var n = steps.length + 1;
    var id = 'step' + n;

    /**
     * Tells whether a step has the id.
     *
     * @param {!Object} x The step.
     * @return {boolean} True when it has.
     */
    function taken(x) {
      return x.id === id;
    }

    while (steps.some(taken)) {
      n += 1;
      id = 'step' + n;
    }
    var count = steps.length + 1;
    steps.push({
      id: id,
      label: { en: 'Review step ' + count, ar: 'خطوة مراجعة ' + count }
    });
  }

  /**
   * Draws the switch that matches registrations to pasted WhatsApp
   * requests.
   *
   * @param {!Object} f The form, changed in place.
   * @return {!Element} The switch.
   */
  function matchingSwitch(f) {
    return A.check(
      'Match registrations to pasted WhatsApp requests',
      f.matching?.enabled,
      function (v) {
        f.matching = Object.assign({ field: 'phone' }, f.matching || {}, {
          enabled: v
        });
      }
    );
  }

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} f The form.
   * @return {string} The names of the steps, or 'None'.
   */
  function summary(f) {
    if (!f.review.steps.length) return 'None';
    return f.review.steps
      .map(function (x) {
        return x.label.en;
      })
      .join(', ');
  }

  /**
   * Draws the Review steps panel. f.review is filled in.
   *
   * @param {!Object} s The settings page: `f`.
   * @return {!Element} The panel.
   */
  A.reviewPanel = function (s) {
    var f = s.f;
    f.review = f.review || { steps: [] };
    var r = { f: f, box: h('div') };
    r.paint = paint.bind(null, r);
    r.paint();
    var panel = A.panel(
      'Review steps',
      'Reviewers (you or an instructor link that can review) mark each step' +
        ' as pending, approved, or rejected.',
      r.box,
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet',
          name: 'addStep',
          onclick: function () {
            addStep(f.review.steps);
            r.paint();
          }
        },
        icon('plus', A.ICON_SIZE.BUTTON),
        'Add a review step'
      ),
      f.type === FormType.WHATSAPP_REGISTRATION ? matchingSwitch(f) : null
    );
    panel.summary = summary.bind(null, f);
    return panel;
  };
})(window.App);

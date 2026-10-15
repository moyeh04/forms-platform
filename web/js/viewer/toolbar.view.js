/**
 * The toolbar of the instructor page: the form picker when the link shows
 * more than one form, the views of a booking form, the search, Refresh and
 * Print.
 */
(function (App) {
  'use strict';

  var V = App.viewer;
  var S = V.state;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  /** The size of a toolbar icon. */
  var TOOL_ICON = 18;

  /**
   * Draws a select.
   *
   * @param {string} value The picked value.
   * @param {!Array<!Array<string>>} options Each option as [value, text].
   * @param {function(string)} onchange What a pick does.
   * @return {!Element} The select.
   */
  V.select = function (value, options, onchange) {
    return h(
      'select',
      {
        class: 'select',
        onchange: function (e) {
          onchange(e.target.value);
        }
      },
      options.map(function (o) {
        return h(
          'option',
          { value: o[0], selected: String(o[0]) === String(value) },
          o[1]
        );
      })
    );
  };

  /**
   * Draws the picker of the forms the link shows.
   *
   * @return {!Element} The picker.
   */
  function formPicker() {
    var sel = V.select(
      S.slug,
      S.me.forms.map(function (f) {
        var caption = FormMetadata.caption(f);
        return [f.slug, f.title + (caption ? ' (' + caption + ')' : '')];
      }),
      function (v) {
        S.slug = v;
        S.mode = 'auto';
        S.dayId = '';
        S.q = '';
        V.reload();
      }
    );
    sel.setAttribute('aria-label', 'Form');
    return sel;
  }

  /**
   * Draws the button of a view of a booking form.
   *
   * @param {!Object} d The data of the form.
   * @param {!Array<string>} m The view, as [mode, label].
   * @return {!Element} The button.
   */
  function modeButton(d, m) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn sm ' + (S.mode === m[0] ? 'btn-primary' : 'btn-quiet'),
        dataset: { mode: m[0] },
        'aria-pressed': S.mode === m[0] ? 'true' : 'false',
        onclick: function () {
          S.mode = m[0];
          if (m[0] === 'day' && !S.dayId && d.days[0]) S.dayId = d.days[0].id;
          V.reload();
        }
      },
      m[1]
    );
  }

  /**
   * Draws the views of a booking form (Today when a day is dated, By day,
   * All) and, by day, the picker of the day.
   *
   * @param {!Object} d The data of the form.
   * @return {!Array<!Element>} The controls.
   */
  function reservationTools(d) {
    var dated = (d.days || []).some(function (x) {
      return x.date;
    });
    var modes = [];
    if (dated) modes.push(['today', 'Today']);
    modes.push(['day', 'By day'], ['all', 'All']);
    var sel;
    var out = modes.map(function (m) {
      return modeButton(d, m);
    });
    if (S.mode === 'day') {
      sel = V.select(
        S.dayId,
        d.days.map(function (x) {
          return [x.id, x.label];
        }),
        function (v) {
          S.dayId = v;
          V.reload();
        }
      );
      sel.setAttribute('aria-label', 'Day');
      out.push(sel);
    }
    return out;
  }

  /**
   * Draws a quiet button with an icon.
   *
   * @param {string} name Its name.
   * @param {string} glyph Its icon.
   * @param {string} label Its text.
   * @param {function()} onclick What it does.
   * @return {!Element} The button.
   */
  function toolButton(name, glyph, label, onclick) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm',
        name: name,
        onclick: onclick
      },
      icon(glyph, TOOL_ICON),
      label
    );
  }

  /**
   * Draws the toolbar of the open form.
   *
   * @param {!Object} d The data of the form.
   * @return {!Element} The toolbar.
   */
  V.toolbar = function (d) {
    var tools = [];
    if (S.me.forms.length > 1) tools.push(formPicker());
    if (d.kind === 'reservation') tools.push(...reservationTools(d));
    tools.push(
      h('input', {
        class: 'input',
        type: 'search',
        name: 'search',
        placeholder: 'Search',
        'aria-label': 'Search',
        value: S.q,
        oninput: function (e) {
          S.q = e.target.value;
          V.paintBody();
        }
      }),
      toolButton('refresh', 'refresh', 'Refresh', function () {
        V.reload('Updated');
      }),
      toolButton('print', 'printer', 'Print or save as PDF', function () {
        window.print();
      })
    );
    return h('div', { class: 'toolbar' }, tools);
  };
})(window.App);

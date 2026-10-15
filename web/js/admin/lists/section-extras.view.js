/**
 * The sections of a list that follow no year-kind-number pattern, kept as
 * written, each with its remove button.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var h = App.ui.h;
  var icon = App.ui.icon;

  /** The size of the x on a chip. */
  var CHIP_ICON = 14;

  /**
   * Draws the sections kept as written, each with its remove button.
   *
   * @param {!Object} p The page.
   * @return {!Element} The block.
   */
  L.sectionExtras = function (p) {
    var s = p.sections;
    return h(
      'div',
      { class: 'sec-extras' },
      h('span', { class: 'label' }, 'Other sections'),
      h(
        'p',
        { class: 'help' },
        'These do not follow the year-kind-number pattern, so they are kept' +
          ' as they are.'
      ),
      h(
        'ul',
        { class: 'value-chips' },
        s.extras.map(function (v) {
          return h(
            'li',
            { class: 'value-chip' },
            h('span', { dir: 'auto' }, v),
            h(
              'button',
              {
                type: 'button',
                name: 'remove-extra-' + v,
                'aria-label': 'Remove ' + v,
                onclick: function () {
                  s.extras = s.extras.filter(function (x) {
                    return x !== v;
                  });
                  p.setRows(L.plainRows(L.writeSections(s)));
                }
              },
              icon('x', CHIP_ICON)
            )
          );
        })
      )
    );
  };
})(window.App);

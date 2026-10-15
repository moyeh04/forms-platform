/**
 * The keys line of a form's Setup: how many keys are given and how many
 * have ended, with the Extend keys button.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /**
   * Writes how many keys are given and how many have ended.
   *
   * @param {!Array<!Object>} keys The keys.
   * @return {!Element} The line.
   */
  function countLine(keys) {
    var expired = keys.filter(function (k) {
      return k.expired;
    }).length;
    var given = h(
      'strong',
      null,
      A.plural(keys.length, 'key', 'keys') + ' given'
    );
    if (!expired) return h('p', null, given, ', all working.');
    return h(
      'p',
      null,
      given,
      ': ' + (keys.length - expired) + ' working, ',
      h('span', { class: 'warn-text' }, expired + ' expired'),
      '.'
    );
  }

  /**
   * Draws the keys line of a form. It shows nothing while there are no
   * keys, since there is nothing to extend, and nothing when they cannot
   * be read.
   *
   * @param {!Object} form The form.
   * @return {!Element} The line.
   */
  A.keysSummary = function (form) {
    var box = h('div', { class: 'keys-summary', hidden: true });

    /** Reads the keys and draws the line again. */
    async function load() {
      var keys;
      try {
        keys = (await A.call('admin.keys.list', { slug: form.slug })).keys;
      } catch {
        return;
      }
      App.ui.clear(box);
      box.hidden = !keys.length;
      if (!keys.length) return;
      box.appendChild(countLine(keys));
      box.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-quiet',
            name: 'extend-keys',
            onclick: function (e) {
              A.busy(e.currentTarget, function () {
                return A.extendKeys(form, { done: load });
              });
            }
          },
          App.ui.icon('calendar', A.ICON_SIZE.LINE),
          'Extend keys'
        )
      );
    }

    load();
    return box;
  };
})(window.App);

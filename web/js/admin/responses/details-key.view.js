/**
 * The edit key rows of the Details dialog: the key, shown on request with
 * a copy button, and the date it works until, with a button to move it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;
  var toast = ui.toast;

  /**
   * Fetches the key of a submission and shows it with a copy button.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {!Element} box The cell of the key.
   * @return {!Promise} Settles once it is shown.
   */
  async function showKey(form, s, box) {
    var k = await A.call('admin.submission.key', {
      slug: form.slug,
      submissionId: s.id
    });
    ui.clear(box);
    box.appendChild(h('span', { class: 'key-inline' }, k.key));
    box.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet sm',
          onclick: async function () {
            toast(
              (await ui.copyText(k.key)) ? 'Key copied' : 'Could not copy',
              'ok'
            );
          }
        },
        icon('copy', A.ICON_SIZE.MENU),
        'Copy'
      )
    );
  }

  /**
   * Draws the cell of the key: the Show key button, and a note when the
   * key was issued before keys could be shown.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @return {!Element} The cell.
   */
  function keyCell(form, s) {
    var box = h('dd', { class: 'key-cell' });
    box.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet sm',
          name: 'show-key',
          onclick: function (e) {
            A.busy(e.currentTarget, showKey.bind(null, form, s, box));
          }
        },
        icon('eye', A.ICON_SIZE.MENU),
        'Show key'
      )
    );
    if (!s.keyKnown) {
      box.appendChild(
        h(
          'span',
          { class: 'muted-note' },
          'Issued before keys could be shown: use Reset key below.'
        )
      );
    }
    return box;
  }

  /**
   * Draws the date the key works until, with the button that moves it.
   * An expired key works again after it.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {!Element} box The cell.
   */
  function paintUntil(form, s, box) {
    var again = paintUntil.bind(null, form, s, box);
    ui.clear(box);
    box.appendChild(A.untilText(s.keyExpires));
    box.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet sm',
          name: 'extend-key',
          onclick: function (e) {
            A.busy(e.currentTarget, function () {
              return A.extendKeys(form, {
                ids: [s.id],
                done: function (keys) {
                  var mine = keys.filter(function (k) {
                    return k.id === s.id;
                  })[0];
                  if (mine) s.keyExpires = mine.keyExpires;
                  again();
                }
              });
            });
          }
        },
        icon('calendar', A.ICON_SIZE.MENU),
        'Extend'
      )
    );
  }

  /**
   * Draws the edit key rows of a submission.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @return {{rows: !Array<!Element>, paintUntil: function()}} The rows,
   *     and what draws the date again once the key is reset.
   */
  R.keyRows = function (form, s) {
    var untilBox = h('dd', { class: 'key-cell' });
    var paint = paintUntil.bind(null, form, s, untilBox);
    paint();
    return {
      rows: [
        h('dt', null, 'Edit key'),
        keyCell(form, s),
        h('dt', null, 'Key works'),
        untilBox
      ],
      paintUntil: paint
    };
  };
})(window.App);

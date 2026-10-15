/**
 * The save bar of the open list, shown only while it differs from its
 * saved copy, and everything else that follows the rows as they are
 * typed: the reason a save is refused, the marked row and the index.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Saves the open list, or shows why it cannot be saved.
   *
   * @param {!Object} p The page.
   * @return {!Promise} Settles once it is saved or refused.
   */
  async function save(p) {
    if (L.problem(p).text) {
      L.changed(p);
      if (p.problemBox.scrollIntoView) {
        p.problemBox.scrollIntoView({ block: 'center' });
      }
      return;
    }
    var out = await A.call('admin.lists.set', {
      key: p.key,
      values: L.fromRows(p.rows, L.kindOf(p))
    });
    p.lists = out.lists;
    p.info = out.info || p.info;
    L.load(p, p.key);
    ui.toast(
      L.kindOf(p) === ListKind.MILESTONES
        ? L.nameOf(p) + ' saved. A form picks the change up in Setup.'
        : L.nameOf(p) +
            ' saved. Every form that uses it shows the new choices.',
      'ok'
    );
    p.paint();
  }

  /**
   * Draws the save bar: what changed, the forms limited to a removed
   * choice, Discard and Save.
   *
   * @param {!Object} p The page.
   * @return {!Element} The bar, hidden until there is a change.
   */
  L.saveBar = function (p) {
    p.barNote = h('span', { class: 'savebar-note', role: 'status' });
    p.barWarn = h('span', { class: 'savebar-warn' });
    p.saveBtn = h('button', {
      type: 'button',
      class: 'btn btn-primary',
      name: 'save-list',
      onclick: function () {
        A.busy(p.saveBtn, save.bind(null, p));
      }
    });
    return h(
      'div',
      { class: 'savebar', hidden: true },
      h('span', { class: 'savebar-text' }, p.barNote, p.barWarn),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet',
          name: 'discard',
          onclick: function () {
            L.load(p, p.key);
            p.paint();
          }
        },
        'Discard'
      ),
      p.saveBtn
    );
  };

  /**
   * Writes what a save would change, and the forms it limits.
   *
   * @param {!Object} p The page.
   */
  function paintNote(p) {
    var c = L.changes(p);
    p.barNote.textContent = L.nameOf(p) + ': ' + c.text + '. Not saved yet.';
    p.barWarn.textContent = c.limited.length
      ? 'Limited to a removed choice: ' +
        c.limited
          .map(function (f) {
            return f.title;
          })
          .join(', ') +
        '.'
      : '';
    p.saveBtn.textContent = 'Save ' + L.nameOf(p);
  }

  /**
   * Draws everything that depends on the rows without touching the
   * fields being typed in.
   *
   * @param {!Object} p The page.
   */
  L.changed = function (p) {
    var isDirty = L.dirty(p);
    var bad = L.problem(p);
    A.unsaved = isDirty;
    p.bar.hidden = !isDirty;
    p.problemBox.hidden = !(isDirty && bad.text);
    p.problemBox.textContent = bad.text;
    Array.prototype.forEach.call(
      p.rowsBox.querySelectorAll('[data-i]'),
      function (el) {
        el.classList.toggle('bad', isDirty && +el.dataset.i === bad.at);
      }
    );
    if (isDirty) paintNote(p);
    L.paintIndex(p);
  };
})(window.App);

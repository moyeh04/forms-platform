/**
 * Admin: the shared lists behind dropdown questions. The admin can make
 * more lists (another set of sections) and pick, per form, which list a
 * question reads. The save bar exists only while the open list differs
 * from its saved copy.
 *
 * The parts of the page share one object, `p`: the lists, their names and
 * the forms; the open list (key, rows, sections, draft, order, renaming)
 * and whether the pane is open or making a new list; the elements every
 * part draws into; and what draws the page again.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Whether the open list may be left: it has no changes, or the admin
   * confirms leaving them.
   *
   * @param {!Object} p The page.
   * @return {!Promise<boolean>} True to leave.
   */
  async function leaveOk(p) {
    if (!L.dirty(p)) return true;
    return ui.confirm({
      title: 'Leave without saving?',
      body: 'Your changes to ' + L.nameOf(p) + ' are not saved.',
      confirmText: 'Leave',
      danger: true
    });
  }

  /**
   * Opens a list, after asking when the open one has changes.
   *
   * @param {!Object} p The page.
   * @param {string} key The list.
   * @return {!Promise} Settles once it is open or not.
   */
  async function select(p, key) {
    var other = key !== p.key || p.creating;
    if (other && !(await leaveOk(p))) return;
    if (other) L.load(p, key);
    p.creating = false;
    p.open = true;
    A.setHash('#/lists/' + encodeURIComponent(key));
    p.paint();
  }

  /**
   * Opens the New list pane, after asking when the open list has changes.
   *
   * @param {!Object} p The page.
   * @return {!Promise} Settles once it is open or not.
   */
  async function startNew(p) {
    if (!(await leaveOk(p))) return;
    L.load(p, p.key);
    p.creating = true;
    p.open = true;
    A.setHash('#/lists/new');
    p.paint();
    var el = p.pane.querySelector('[name="list-name"]');
    if (el?.focus) el.focus();
  }

  /**
   * Takes new rows. `keep`: the editor already shows the change (a
   * stepper), so only the list of every section is drawn again.
   *
   * @param {!Object} p The page.
   * @param {!Array<!Object>} rows The rows.
   * @param {boolean=} keep True to keep the editor as it is.
   */
  function setRows(p, rows, keep) {
    p.rows = rows;
    if (keep) paintPreview(p);
    else paintRows(p);
    L.changed(p);
  }

  /**
   * Removes a row.
   *
   * @param {!Object} p The page.
   * @param {number} i The row.
   */
  function removeRow(p, i) {
    p.rows.splice(i, 1);
    if (p.sections) p.sections = L.readSections(L.values(p));
    paintRows(p);
    L.changed(p);
  }

  /**
   * Draws the editor the kind of the open list needs. A number list that
   * is not a run falls back to the choices editor.
   *
   * @param {!Object} p The page.
   */
  function paintRows(p) {
    var k = L.kindOf(p);
    var ed = null;
    ui.clear(p.rowsBox);
    if (k === ListKind.SECTIONS) ed = L.sectionsEditor(p);
    else if (k === ListKind.NUMBERS) ed = L.numbersEditor(p);
    p.preview = null;
    p.rowsBox.appendChild(ed || L.choicesEditor(p));
    if (k === ListKind.SECTIONS) {
      p.preview = h('div');
      p.rowsBox.appendChild(p.preview);
      paintPreview(p);
    }
  }

  /**
   * Draws every section of the list, folded: the values a save would
   * store. It stays open when it was.
   *
   * @param {!Object} p The page.
   */
  function paintPreview(p) {
    if (!p.preview) return;
    var open = p.preview.firstChild?.open;
    ui.clear(p.preview);
    if (!p.rows.length) return;
    p.preview.appendChild(
      h(
        'details',
        { class: 'list-many sec-preview', open: open || null },
        h(
          'summary',
          null,
          'See all ' + A.plural(p.rows.length, 'section', 'sections')
        ),
        h(
          'ul',
          { class: 'value-chips' },
          p.rows.map(function (r) {
            return h('li', { class: 'value-chip plain' }, r.value);
          })
        )
      )
    );
  }

  /**
   * Draws the pane: the New list pane, or the open list with its editor.
   *
   * @param {!Object} p The page.
   */
  function paintPane(p) {
    var pane = p.pane;
    ui.clear(pane);
    pane.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'link-btn lists-back',
          name: 'all-lists',
          onclick: function () {
            p.open = false;
            p.creating = false;
            A.setHash('#/lists');
            p.paint();
          }
        },
        '‹ All lists'
      )
    );
    if (p.creating) {
      L.createPane(p).forEach(function (n) {
        if (n) pane.appendChild(n);
      });
      return;
    }
    pane.dataset.list = p.key;
    pane.appendChild(L.headPane(p));
    paintRows(p);
    pane.appendChild(p.rowsBox);
    pane.appendChild(p.problemBox);
    pane.appendChild(
      h(
        'p',
        { class: 'muted-note' },
        'A save reaches every form that asks this list. Answers already' +
          ' given are not changed.'
      )
    );
  }

  /**
   * Draws the page again.
   *
   * @param {!Object} p The page.
   */
  function paint(p) {
    p.wrap.classList.toggle('picked', p.open);
    paintPane(p);
    L.changed(p);
  }

  /**
   * Makes the page object with the list the address names. `open` is
   * false while the address names no list: a phone then shows only the
   * lists.
   *
   * @param {!Object} saved The lists and their names.
   * @param {!Array<!Object>} forms Every form.
   * @param {string=} picked The list in the address, or 'new'.
   * @return {!Object} The page.
   */
  function pageOf(saved, forms, picked) {
    var keys = Object.keys(saved.lists);
    var known = keys.indexOf(picked) !== -1;
    var p = {
      lists: saved.lists,
      info: saved.info || {},
      forms: forms,
      key: known ? picked : keys[0],
      open: known || picked === 'new',
      creating: picked === 'new',
      rows: [],
      order: false,
      renaming: false,
      index: h('nav', {
        class: 'l-side lists-index l-stack',
        'aria-label': 'Lists'
      }),
      pane: h('section', { class: 'l-main panel list-pane' }),
      rowsBox: h('div', { class: 'list-rows' }),
      problemBox: h('p', { class: 'error', role: 'alert', hidden: true })
    };
    p.wrap = h('div', { class: 'lists l-split' }, p.index, p.pane);
    p.paint = paint.bind(null, p);
    p.paintRows = paintRows.bind(null, p);
    p.changed = L.changed.bind(null, p);
    p.setRows = setRows.bind(null, p);
    p.removeRow = removeRow.bind(null, p);
    p.select = select.bind(null, p);
    p.startNew = startNew.bind(null, p);
    p.bar = L.saveBar(p);
    return p;
  }

  /**
   * Draws the Lists page.
   *
   * @param {!Element} mount Where the page goes.
   * @param {string=} picked The list in the address, or 'new'.
   * @return {!Promise} Settles once it is drawn.
   */
  A.views.lists = async function (mount, picked) {
    var data = await Promise.all([
      A.call('admin.lists.get'),
      A.call('admin.forms.list')
    ]);
    var p = pageOf(data[0], data[1].forms, picked);
    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' }, h('h2', null, 'Lists')));
    mount.appendChild(
      h(
        'p',
        { class: 'help' },
        'The choices of the dropdown questions. A list is shared: change it' +
          ' here and every form that asks it follows. Make more lists, such' +
          ' as another set of sections, and pick one for a question in the' +
          ' Questions tab of a form.'
      )
    );
    L.load(p, p.key);
    mount.appendChild(p.wrap);
    mount.appendChild(p.bar);
    p.paint();
  };
})(window.App);

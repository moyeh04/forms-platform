/**
 * The New list pane: a name, a kind, and whether it starts as a copy of a
 * list of that kind. The Make button appears once it has a name, and a
 * refused name stays in its field with the reason under it. The pane
 * shares one object, `c`: the page, the new list and its parts.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var ui = App.ui;
  var h = ui.h;

  /** The longest name of a list. */
  var NAME_MAX = 60;

  /**
   * Makes the list and opens it, or shows why its name is refused.
   *
   * @param {!Object} c The pane.
   * @return {!Promise} Settles once it is made or refused.
   */
  async function create(c) {
    var p = c.p;
    var form = c.form;
    var out;
    try {
      out = await A.call('admin.lists.create', {
        name: form.name,
        kind: form.kind,
        copyOf: form.copyOf || undefined
      });
    } catch (e) {
      if (e.code !== 'list_name_taken' && e.code !== 'list_name') throw e;
      c.err.textContent = e.message;
      c.err.hidden = false;
      return;
    }
    p.lists = out.lists;
    p.info = out.info;
    p.newList = null;
    p.creating = false;
    L.load(p, out.key);
    A.setHash('#/lists/' + encodeURIComponent(out.key));
    ui.toast(
      '"' +
        L.nameOf(p, out.key) +
        '" is ready. Pick it for a question in the Questions tab of a form.',
      'ok'
    );
    p.paint();
  }

  /**
   * Draws the Make button once the list has a name.
   *
   * @param {!Object} c The pane.
   */
  function paintActions(c) {
    ui.clear(c.actions);
    if (!c.form.name.trim()) return;
    var btn = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        name: 'create-list',
        onclick: function () {
          A.busy(btn, create.bind(null, c));
        }
      },
      'Make "' + c.form.name.trim() + '"'
    );
    c.actions.appendChild(btn);
  }

  /**
   * Draws the card of a kind, as a radio.
   *
   * @param {!Object} c The pane.
   * @param {string} k The kind.
   * @return {!Element} The card.
   */
  function kindCard(c, k) {
    var kind = L.KINDS[k];
    return h(
      'button',
      {
        type: 'button',
        class: 'kind-card',
        role: 'radio',
        name: 'kind-' + k,
        'aria-checked': c.form.kind === k ? 'true' : 'false',
        onclick: function () {
          c.form.kind = k;
          c.form.copyOf = '';
          paintKinds(c);
        }
      },
      h('strong', null, kind.label),
      h('span', { class: 'kind-example', dir: 'ltr' }, kind.example),
      h('span', { class: 'muted-note' }, kind.about)
    );
  }

  /**
   * Draws the chips of what the list starts with: nothing, or a copy of a
   * list of the same kind.
   *
   * @param {!Object} c The pane.
   * @return {!Element} The chips.
   */
  function copyChips(c) {
    var p = c.p;
    var same = L.keys(p).filter(function (k) {
      return L.kindOf(p, k) === c.form.kind;
    });
    return h(
      'div',
      { class: 'toggle-chips' },
      [['', 'Nothing']]
        .concat(
          same.map(function (k) {
            return [k, 'A copy of ' + L.nameOf(p, k)];
          })
        )
        .map(function (o) {
          return h(
            'button',
            {
              type: 'button',
              class: 'toggle-chip sm',
              name: 'copy-' + (o[0] || 'none'),
              'aria-pressed': c.form.copyOf === o[0] ? 'true' : 'false',
              onclick: function () {
                c.form.copyOf = o[0];
                paintKinds(c);
              }
            },
            o[1]
          );
        })
    );
  }

  /**
   * Draws the kinds and the copies again.
   *
   * @param {!Object} c The pane.
   */
  function paintKinds(c) {
    ui.clear(c.kindBox);
    Object.keys(L.KINDS).forEach(function (k) {
      c.kindBox.appendChild(kindCard(c, k));
    });
    ui.clear(c.fromBox);
    c.fromBox.appendChild(h('span', { class: 'label' }, 'Start with'));
    c.fromBox.appendChild(copyChips(c));
  }

  /**
   * Draws the New list pane. What was typed is kept while the admin looks
   * at another list.
   *
   * @param {!Object} p The page.
   * @return {!Array<!Element>} Its parts.
   */
  L.createPane = function (p) {
    if (!p.newList) {
      p.newList = { name: '', kind: ListKind.SECTIONS, copyOf: '' };
    }
    var c = {
      p: p,
      form: p.newList,
      err: h('p', { class: 'error', role: 'alert', hidden: true }),
      actions: h('div', { class: 'actions' }),
      kindBox: h('div', {
        class: 'kind-cards l-grid',
        role: 'radiogroup',
        'aria-label': 'Kind of list'
      }),
      fromBox: h('div')
    };
    var nameInput = A.text(
      c.form.name,
      function (v) {
        c.form.name = v;
        c.err.hidden = true;
        paintActions(c);
      },
      {
        name: 'list-name',
        placeholder: 'For example: Sections of the third year',
        maxlength: String(NAME_MAX)
      }
    );
    paintKinds(c);
    paintActions(c);
    return [
      h('h2', null, 'New list'),
      h(
        'p',
        { class: 'help' },
        'A list can be asked by any number of forms. After you make it, pick' +
          ' it for a question in the Questions tab of a form.'
      ),
      A.field('Name', nameInput),
      c.err,
      h('span', { class: 'label' }, 'Kind'),
      c.kindBox,
      c.fromBox,
      c.actions
    ];
  };
})(window.App);

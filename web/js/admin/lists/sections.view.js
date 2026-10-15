/**
 * The editor of a section list: a card for each year group with a
 * stepper for each kind, the button that opens a new group, and the
 * sections kept as written because they follow no pattern.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  /** The most sections of one kind in a group. */
  var MAX_COUNT = 99;

  /**
   * Writes the groups into the rows and draws the editor again.
   *
   * @param {!Object} p The page.
   * @param {!Object} s The groups.
   */
  function apply(p, s) {
    p.setRows(L.plainRows(L.writeSections(s)));
  }

  /**
   * Counts the sections of a group.
   *
   * @param {!Object} g The group.
   * @return {number} The sections.
   */
  function total(g) {
    return g.kinds.reduce(function (n, k) {
      return n + k.count;
    }, 0);
  }

  /**
   * Opens the card of a new year group.
   *
   * @param {!Object} p The page.
   */
  function openDraft(p) {
    p.draft = { year: '', letter: '', typing: false, counts: {}, kinds: [] };
    p.paintRows();
    var first = p.rowsBox.querySelector('[name^="group-year-"]');
    if (first?.focus) first.focus();
  }

  /**
   * Draws how many groups there are, and the button that adds one.
   *
   * @param {!Object} p The page.
   * @param {number} count How many groups.
   * @return {!Element} The row.
   */
  function topRow(p, count) {
    return h(
      'div',
      { class: 'sec-top' },
      h(
        'span',
        { class: 'muted-note' },
        count
          ? A.plural(count, 'year group', 'year groups')
          : 'No year groups yet.'
      ),
      p.draft
        ? null
        : h(
            'button',
            {
              type: 'button',
              class: 'btn sm ' + (count ? 'btn-quiet' : 'btn-primary'),
              name: 'add-group-open',
              onclick: openDraft.bind(null, p)
            },
            icon('plus', A.ICON_SIZE.MENU),
            'Add a year group'
          )
    );
  }

  /**
   * Draws a trash button.
   *
   * @param {string} name Its name.
   * @param {string} label What it removes.
   * @param {function()} onclick What it does.
   * @return {!Element} The button.
   */
  function trash(name, label, onclick) {
    return h(
      'button',
      {
        type: 'button',
        class: 'icon-btn sm danger',
        name: name,
        'aria-label': label,
        onclick: onclick
      },
      icon('trash', A.ICON_SIZE.MENU)
    );
  }

  /**
   * Names the sections a kind of a group gives.
   *
   * @param {!Object} g The group.
   * @param {!Object} k The kind.
   * @return {string} The range, such as 4C-TH1 to TH8.
   */
  function rangeText(g, k) {
    return (
      g.name +
      '-' +
      k.code +
      '1' +
      (k.count > 1 ? ' to ' + k.code + k.count : '')
    );
  }

  /**
   * Adds a kind to a group with one section.
   *
   * @param {!Object} gc The card.
   * @param {string} code The kind.
   */
  function addKind(gc, code) {
    gc.g.kinds.push({ code: code, count: 1 });
    apply(gc.p, gc.s);
  }

  /**
   * Draws a kind of a group: its code, its count and the sections it
   * gives. A kind leaves the group with its own button, never by counting
   * down, and the last kind goes with the group, so a group never empties
   * by itself.
   *
   * @param {!Object} gc The card: page, groups, group and sum.
   * @param {!Object} k The kind.
   * @param {number} ki Where it is in the group.
   * @return {!Element} The kind.
   */
  function kindRow(gc, k, ki) {
    var g = gc.g;
    var range = h('span', { class: 'sec-range muted-note' }, rangeText(g, k));
    return h(
      'div',
      { class: 'sec-kind' + (g.kinds.length > 1 ? ' removable' : '') },
      h('span', { class: 'sec-code' }, k.code),
      L.stepper({
        name: 'count-' + g.name + '-' + k.code,
        label: k.code + ' sections of ' + g.name,
        value: k.count,
        lo: 1,
        hi: MAX_COUNT,
        set: function (v) {
          k.count = v;
          range.textContent = rangeText(g, k);
          gc.sum.textContent = A.plural(total(g), 'section', 'sections');
          gc.p.setRows(L.plainRows(L.writeSections(gc.s)), true);
        }
      }),
      range,
      g.kinds.length > 1
        ? trash(
            'remove-kind-' + g.name + '-' + k.code,
            'Remove ' + k.code + ' from ' + g.name,
            function () {
              g.kinds.splice(ki, 1);
              apply(gc.p, gc.s);
            }
          )
        : null
    );
  }

  /**
   * Draws the kinds a group can add: those of other groups, and a new
   * one.
   *
   * @param {!Object} gc The card.
   * @param {!Object} parts The kinds, letters and years in use.
   * @return {!Element} The row.
   */
  function moreKinds(gc, parts) {
    var g = gc.g;
    var used = g.kinds.map(function (k) {
      return k.code;
    });
    var add = addKind.bind(null, gc);
    return h(
      'div',
      { class: 'sec-more' },
      h('span', { class: 'muted-note' }, 'Add a kind:'),
      parts.kinds
        .filter(function (c) {
          return used.indexOf(c) === -1;
        })
        .map(function (c) {
          return h(
            'button',
            {
              type: 'button',
              class: 'toggle-chip sm',
              name: 'add-kind-' + g.name + '-' + c,
              onclick: function () {
                add(c);
              }
            },
            '+ ' + c
          );
        }),
      L.newKindChip('kind-' + g.name, parts.kinds, add)
    );
  }

  /**
   * Draws the card of a year group.
   *
   * @param {!Object} p The page.
   * @param {!Object} parts The kinds, letters and years in use.
   * @param {!Object} g The group.
   * @param {number} gi Where it is in the list.
   * @return {!Element} The card.
   */
  function groupCard(p, parts, g, gi) {
    var s = p.sections;
    var gc = {
      p: p,
      s: s,
      g: g,
      sum: h(
        'span',
        { class: 'muted-note' },
        A.plural(total(g), 'section', 'sections')
      )
    };
    return h(
      'div',
      { class: 'sec-group', dataset: { group: g.name } },
      h(
        'div',
        { class: 'sec-group-head' },
        h('strong', { class: 'sec-group-name', tabindex: '-1' }, g.name),
        gc.sum,
        trash(
          'remove-group-' + g.name,
          'Remove the group ' + g.name,
          function () {
            s.groups.splice(gi, 1);
            apply(p, s);
          }
        )
      ),
      h(
        'div',
        { class: 'sec-kinds' },
        g.kinds.map(function (k, ki) {
          return kindRow(gc, k, ki);
        })
      ),
      moreKinds(gc, parts)
    );
  }

  /**
   * Draws the editor of a section list.
   *
   * @param {!Object} p The page.
   * @return {!Element} The editor.
   */
  L.sectionsEditor = function (p) {
    var s = p.sections;
    var parts = L.sectionParts(p, s);
    var box = h('div', { class: 'sec-editor l-stack' });
    box.appendChild(topRow(p, s.groups.length));
    if (p.draft) box.appendChild(L.groupDraft(p, parts));
    s.groups.forEach(function (g, gi) {
      box.appendChild(groupCard(p, parts, g, gi));
    });
    if (s.extras.length) box.appendChild(L.sectionExtras(p));
    return box;
  };
})(window.App);

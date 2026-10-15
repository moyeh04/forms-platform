/**
 * A new year group, drawn as a card where it is added: a year, a
 * department letter, and how many sections of each kind. Every kind
 * starts at 0, meaning "not in this group"; nothing is taken from another
 * group. Add appears, named after the group, once the group can be added;
 * until then the line under the counts says what is missing. The card
 * shares one object, `dr`: the page, the draft, its kinds and its parts.
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
   * Draws the editor again and puts the focus back on a control.
   *
   * @param {!Object} dr The card.
   * @param {string=} focusName The name of the control.
   */
  function redraw(dr, focusName) {
    dr.p.paintRows();
    var el =
      focusName && dr.p.rowsBox.querySelector('[name="' + focusName + '"]');
    if (el?.focus) el.focus();
  }

  /**
   * Adds the group in its place and shows its card.
   *
   * @param {!Object} dr The card.
   */
  function add(dr) {
    if (!L.draftReady(dr)) return;
    var p = dr.p;
    var s = p.sections;
    var d = dr.d;
    var name = L.draftName(dr);
    s.groups.splice(L.groupSlot(s.groups, name), 0, {
      name: name,
      kinds: dr.kinds
        .filter(function (k) {
          return d.counts[k] > 0;
        })
        .map(function (k) {
          return { code: k, count: d.counts[k] };
        })
    });
    p.draft = null;
    p.setRows(L.plainRows(L.writeSections(s)));
    var head = p.rowsBox.querySelector(
      '[data-group="' + name + '"] .sec-group-name'
    );
    if (head?.scrollIntoView) head.scrollIntoView({ block: 'center' });
    if (head?.focus) head.focus();
  }

  /**
   * Draws what is missing, Cancel, and Add once the group can be added.
   *
   * @param {!Object} dr The card.
   */
  function paintFoot(dr) {
    var foot = dr.foot;
    ui.clear(foot);
    foot.appendChild(
      h(
        'p',
        { class: 'muted-note', name: 'group-missing', role: 'status' },
        L.draftMissing(dr)
      )
    );
    foot.appendChild(
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-quiet sm',
            name: 'add-group-cancel',
            onclick: function () {
              dr.p.draft = null;
              redraw(dr, 'add-group-open');
            }
          },
          'Cancel'
        ),
        L.draftReady(dr)
          ? h(
              'button',
              {
                type: 'button',
                class: 'btn btn-primary sm',
                name: 'add-group',
                onclick: add.bind(null, dr)
              },
              icon('plus', A.ICON_SIZE.MENU),
              'Add ' + L.draftName(dr)
            )
          : null
      )
    );
  }

  /**
   * Names the sections a kind of the new group gives.
   *
   * @param {!Object} dr The card.
   * @param {string} k The kind.
   * @return {string} The range, such as 4C-TH1 to TH3, or None.
   */
  function rangeText(dr, k) {
    var n = dr.d.counts[k] || 0;
    var name = L.draftName(dr) || 'The group';
    return n ? name + '-' + k + '1' + (n > 1 ? ' to ' + k + n : '') : 'None';
  }

  /**
   * Draws a kind of the new group with its count and the sections it
   * gives.
   *
   * @param {!Object} dr The card.
   * @param {string} k The kind.
   * @return {!Element} The kind.
   */
  function kindRow(dr, k) {
    var d = dr.d;
    var range = h('span', { class: 'sec-range muted-note' }, rangeText(dr, k));
    return h(
      'div',
      { class: 'sec-kind' },
      h('span', { class: 'sec-code' }, k),
      L.stepper({
        name: 'draft-count-' + k,
        label: k + ' sections of the new group',
        value: d.counts[k] || 0,
        lo: 0,
        hi: MAX_COUNT,
        set: function (v) {
          d.counts[k] = v;
          range.textContent = rangeText(dr, k);
          paintFoot(dr);
        },
        enter: add.bind(null, dr)
      }),
      range
    );
  }

  /**
   * Draws the card of a new year group.
   *
   * @param {!Object} p The page.
   * @param {!Object} parts The kinds, letters and years in use.
   * @return {!Element} The card.
   */
  L.groupDraft = function (p, parts) {
    var d = p.draft;
    var dr = {
      p: p,
      d: d,
      kinds: parts.kinds.concat(
        d.kinds.filter(function (k) {
          return parts.kinds.indexOf(k) === -1;
        })
      ),
      card: h('div', {
        class: 'sec-group sec-draft',
        name: 'group-draft',
        role: 'group',
        'aria-label': 'New year group'
      }),
      foot: h('div', { class: 'sec-foot' })
    };
    var card = dr.card;
    dr.redraw = redraw.bind(null, dr);
    dr.paintFoot = paintFoot.bind(null, dr);
    card.appendChild(h('h3', null, 'New year group'));
    L.draftPicks(dr, parts).forEach(function (row) {
      card.appendChild(row);
    });
    card.appendChild(
      h('div', { class: 'sec-kinds' }, dr.kinds.map(kindRow.bind(null, dr)))
    );
    card.appendChild(
      h(
        'div',
        { class: 'sec-more' },
        L.newKindChip('draft-kind', dr.kinds, function (code) {
          d.kinds.push(code);
          d.counts[code] = 1;
          redraw(dr, 'draft-count-' + code);
        })
      )
    );
    card.appendChild(dr.foot);
    paintFoot(dr);
    return card;
  };
})(window.App);

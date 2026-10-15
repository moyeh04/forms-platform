/**
 * The index of the Lists page: New list, then a card for each list with
 * its name, its kind, its first choices and how many forms ask it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var ui = App.ui;
  var h = ui.h;

  /** How many choices a card shows before "…". */
  var PEEK = 4;

  /**
   * Writes the first choices of a list.
   *
   * @param {!Array<!Object>} values The choices.
   * @return {string} The choices, or ''.
   */
  function peekOf(values) {
    return (
      values
        .slice(0, PEEK)
        .map(function (o) {
          return o.label?.en || o.value;
        })
        .join(', ') + (values.length > PEEK ? ' …' : '')
    );
  }

  /**
   * Draws the badge beside the name of a list: Not saved while the open
   * list has changes, otherwise its kind when the name does not say it.
   *
   * @param {!Object} p The page.
   * @param {string} k The list.
   * @param {boolean} current True for the open list.
   * @return {?Element} The badge.
   */
  function badgeOf(p, k, current) {
    var kindLabel = L.KINDS[L.kindOf(p, k)].label;
    if (current && L.dirty(p)) {
      return h('span', { class: 'badge draft' }, 'Not saved');
    }
    if (L.nameOf(p, k) !== kindLabel) {
      return h('span', { class: 'list-card-kind' }, kindLabel);
    }
    return null;
  }

  /**
   * Draws the card of a list. The open list shows its edits.
   *
   * @param {!Object} p The page.
   * @param {string} k The list.
   * @return {!Element} The card.
   */
  function card(p, k) {
    var current = k === p.key && !p.creating;
    var values = current ? L.fromRows(p.rows, L.kindOf(p)) : p.lists[k] || [];
    var users = L.formsUsing(p.forms, k).length;
    return h(
      'button',
      {
        type: 'button',
        class: 'list-card',
        name: 'pick-' + k,
        'aria-current': current ? 'true' : null,
        onclick: function () {
          p.select(k);
        }
      },
      h(
        'span',
        { class: 'list-card-name' },
        L.nameOf(p, k),
        badgeOf(p, k, current)
      ),
      h(
        'span',
        { class: 'list-card-peek', dir: 'auto' },
        peekOf(values) || 'No choices yet'
      ),
      h(
        'span',
        { class: 'list-card-meta' },
        (L.kindOf(p, k) === ListKind.MILESTONES
          ? A.plural(values.length, 'milestone', 'milestones')
          : A.plural(values.length, 'choice', 'choices')) +
          ' · ' +
          (users ? A.plural(users, 'form', 'forms') : 'no form yet')
      )
    );
  }

  /**
   * Draws the index again.
   *
   * @param {!Object} p The page.
   */
  L.paintIndex = function (p) {
    ui.clear(p.index);
    p.index.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet list-new',
          name: 'new-list',
          'aria-current': p.creating ? 'true' : null,
          onclick: function () {
            p.startNew();
          }
        },
        ui.icon('plus', A.ICON_SIZE.LINE),
        'New list'
      )
    );
    L.keys(p).forEach(function (k) {
      p.index.appendChild(card(p, k));
    });
  };
})(window.App);

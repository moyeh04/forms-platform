/**
 * The team members: a card per member, the list that grows and shrinks with the
 * team size, and the teammates of a reservation.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = P.t;
  var root = P.root;
  var S = P.S;

  /** The size of the icons on the member buttons, in pixels. */
  var BUTTON_ICON_SIZE = 18;

  /** The size of the icon on the add button, in pixels. */
  var ADD_ICON_SIZE = 20;

  /**
   * Makes the remove button of a member card.
   *
   * @param {number} i The member.
   * @param {function(number)} remove Removes a member.
   * @return {!Element} The button.
   */
  function removeButton(i, remove) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet',
        name: 'remove-member-' + i,
        'aria-label': t('removeMember') + ' ' + (i + 1),
        onclick: function () {
          remove(i);
        }
      },
      icon('trash', BUTTON_ICON_SIZE),
      t('removeMember')
    );
  }

  /**
   * Draws the card of a member, with its questions. `remove` is given only
   * when the team can lose a member; then the card has the button.
   *
   * @param {!Object} field The members question.
   * @param {string} path The path of the list.
   * @param {number} i The member.
   * @param {?function(number)} remove Removes a member, or null.
   * @return {!Element} The card.
   */
  function memberCard(field, path, i, remove) {
    var subs = (field.fields || []).filter(function (sf) {
      return sf.enabled !== false;
    });
    return h(
      'div',
      { class: 'member' },
      h(
        'div',
        { class: 'member-head' },
        h('span', { class: 'member-title' }, t('memberN', { n: i + 1 })),
        remove ? removeButton(i, remove) : null
      ),
      subs.map(function (sf) {
        return P.renderField(sf, path + '.' + i + '.' + sf.id);
      })
    );
  }

  /**
   * Makes the Undo button of a removed member.
   *
   * @param {function()} undo Brings the member back.
   * @return {!Element} The button.
   */
  function undoButton(undo) {
    return h(
      'button',
      { type: 'button', class: 'link-btn', name: 'undo-remove', onclick: undo },
      t('undo')
    );
  }

  /** Focuses the first box of the last member card. */
  function focusLastMember() {
    var cards = root.querySelectorAll('.member');
    var last = cards.length ? cards[cards.length - 1] : null;
    var input = last?.querySelector('input, select');
    if (input?.focus) input.focus();
  }

  /**
   * Draws the member forms with one remove button each and one add button.
   * `limits.resize(list)` stores the new list; with a team size question
   * it also moves the chosen size, so the two never disagree. A removed
   * member comes back with Undo, because the form it held may have been
   * filled in.
   *
   * @param {!Object} field The members question.
   * @param {string} path The path of the list.
   * @param {!Array<!Object>} list The members.
   * @param {{min: number, max: number, resize: function(!Array)}} limits
   *     The fewest and most members, and how to store a new list.
   * @return {!Array<?Element>} The cards, the size line and the add button.
   */
  function memberList(field, path, list, limits) {
    /**
     * Stores a new list and draws it.
     *
     * @param {!Array<!Object>} next The new list.
     * @param {?Object=} banner The banner to show, such as the Undo note.
     */
    function commit(next, banner) {
      S.errors = dropErrors(path);
      delete S.errors[path];
      limits.resize(next);
      S.banner = banner || null;
      P.saveDraft();
      P.render();
    }

    /**
     * Removes a member, with Undo in the banner.
     *
     * @param {number} i The member.
     */
    function remove(i) {
      var before = list.slice();
      var undo = undoButton(function () {
        commit(before);
      });
      commit(
        list.filter(function (_m, k) {
          return k !== i;
        }),
        { kind: 'info', text: t('memberRemoved', { n: i + 1 }), action: undo }
      );
    }

    var canRemove = list.length > limits.min;
    var cards = list.map(function (_m, i) {
      return memberCard(field, path, i, canRemove ? remove : null);
    });
    var add = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet',
        name: 'add-member',
        onclick: function () {
          commit(list.concat([P.freshMember(field)]));
          focusLastMember();
        }
      },
      icon('plus', ADD_ICON_SIZE),
      t('addMember')
    );
    return [
      list.length ? h('div', { class: 'members' }, cards) : null,
      list.length
        ? h('p', { class: 'team-size' }, t('teamSize', { n: list.length + 1 }))
        : null,
      list.length < limits.max ? add : null
    ];
  }

  /**
   * Draws the members of a form with a team size question: the chosen
   * size decides how many member forms are shown, and add and remove move
   * it.
   *
   * @param {!Object} field The members question.
   * @param {string} path The path of the list.
   * @param {!Object} sf The team size question.
   * @param {!Element} wrap The box the members go in.
   */
  function sizedMembers(field, path, sf, wrap) {
    var size = parseInt(S.data[sf.id], 10);
    if (Number.isNaN(size)) {
      wrap.appendChild(h('p', { class: 'help pick-size' }, t('pickSize')));
      return;
    }
    if (P.getVal(path).length !== size - 1) P.syncMembers(size);
    if (size === 1) {
      wrap.appendChild(h('p', { class: 'help solo-team' }, t('soloTeam')));
    }
    var range = Rules.teamSizeRange(S.form);
    wrap.append(
      ...memberList(field, path, P.getVal(path), {
        min: range.min - 1,
        max: range.max - 1,
        resize: function (next) {
          P.setVal(path, next);
          P.setVal(sf.id, String(next.length + 1));
          delete S.errors[sf.id];
        }
      }).filter(Boolean)
    );
  }

  /**
   * Draws the members of a form without a team size question: only the add
   * and remove buttons, and the note the admin set for that many
   * teammates.
   *
   * @param {!Object} field The members question.
   * @param {string} path The path of the list.
   * @param {!Element} wrap The box the members go in.
   */
  function freeMembers(field, path, wrap) {
    var list = P.getVal(path);
    var range = Rules.teamSizeRange(S.form);
    wrap.append(
      ...memberList(field, path, list, {
        min: field.min == null ? 0 : field.min,
        max: field.max == null ? range.max - 1 : field.max,
        resize: function (next) {
          P.setVal(path, next);
        }
      }).filter(Boolean)
    );
    var note = Rules.teammateNotice(S.form, list.length, App.i18n.lang);
    if (note) wrap.appendChild(P.sizeNote(note));
  }

  /**
   * Draws the members question.
   *
   * @param {!Object} field The question.
   * @param {string} path The path of its list.
   * @return {!Element} The members.
   */
  function membersControl(field, path) {
    var wrap = h('div', { class: 'members-wrap' });
    if (!Array.isArray(P.getVal(path))) P.setVal(path, []);
    var sf = P.sizeField();
    if (sf) sizedMembers(field, path, sf, wrap);
    else freeMembers(field, path, wrap);
    return wrap;
  }

  /**
   * Gives the errors without those of a list's items.
   *
   * @param {string} prefix The path of the list.
   * @return {!Object} The other errors.
   */
  function dropErrors(prefix) {
    var out = {};
    Object.keys(S.errors).forEach(function (k) {
      if (k.indexOf(prefix + '.') !== 0) out[k] = S.errors[k];
    });
    return out;
  }

  P.membersControl = membersControl;
  P.dropErrors = dropErrors;
})(window.App);

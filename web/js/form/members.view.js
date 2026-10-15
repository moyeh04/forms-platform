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

  /** `remove` is given only when the team can lose a member; then the card has the button. */
  function memberCard(field, path, i, remove) {
    var subs = (field.fields || []).filter(function (sf) {
      return sf.enabled !== false;
    });
    var head = h(
      'div',
      { class: 'member-head' },
      h('span', { class: 'member-title' }, t('memberN', { n: i + 1 })),
      remove
        ? h(
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
            icon('trash', 18),
            t('removeMember')
          )
        : null
    );
    return h(
      'div',
      { class: 'member' },
      head,
      subs.map(function (sf) {
        return P.renderField(sf, path + '.' + i + '.' + sf.id);
      })
    );
  }

  /**
   * The member forms with one remove button each and one add button. `resize(list)` stores the
   * new list; with a team size question it also moves the chosen size, so the two never disagree.
   * A removed member comes back with Undo, because the form it held may have been filled in.
   */
  function memberList(field, path, list, min, max, resize) {
    var commit = function (next, banner) {
      S.errors = dropErrors(path);
      delete S.errors[path];
      resize(next);
      S.banner = banner || null;
      P.saveDraft();
      P.render();
    };
    var remove =
      list.length > min
        ? function (i) {
            var before = list.slice();
            commit(
              list.filter(function (m, k) {
                return k !== i;
              }),
              {
                kind: 'info',
                text: t('memberRemoved', { n: i + 1 }),
                action: h(
                  'button',
                  {
                    type: 'button',
                    class: 'link-btn',
                    name: 'undo-remove',
                    onclick: function () {
                      commit(before);
                    }
                  },
                  t('undo')
                )
              }
            );
          }
        : null;
    return [
      list.length
        ? h(
            'div',
            { class: 'members' },
            list.map(function (m, i) {
              return memberCard(field, path, i, remove);
            })
          )
        : null,
      list.length
        ? h('p', { class: 'team-size' }, t('teamSize', { n: list.length + 1 }))
        : null,
      list.length < max
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn btn-quiet',
              name: 'add-member',
              onclick: function () {
                commit(list.concat([P.freshMember(field)]));
                var cards = root.querySelectorAll('.member');
                var input =
                  cards.length &&
                  cards[cards.length - 1].querySelector('input, select');
                if (input && input.focus) input.focus();
              }
            },
            icon('plus', 20),
            t('addMember')
          )
        : null
    ];
  }

  function membersControl(field, path) {
    var wrap = h('div', { class: 'members-wrap' });
    var sf = P.sizeField();
    var list = P.getVal(path);
    if (!Array.isArray(list)) {
      list = [];
      P.setVal(path, list);
    }
    var range = Rules.teamSizeRange(S.form);

    if (sf) {
      // The chosen team size decides how many member forms are shown; add and remove move it.
      var size = parseInt(S.data[sf.id], 10);
      if (isNaN(size)) {
        wrap.appendChild(h('p', { class: 'help pick-size' }, t('pickSize')));
        return wrap;
      }
      if (list.length !== size - 1) {
        P.syncMembers(size);
        list = P.getVal(path);
      }
      if (size === 1)
        wrap.appendChild(h('p', { class: 'help solo-team' }, t('soloTeam')));
      memberList(
        field,
        path,
        list,
        range.min - 1,
        range.max - 1,
        function (next) {
          P.setVal(path, next);
          P.setVal(sf.id, String(next.length + 1));
          delete S.errors[sf.id];
        }
      ).forEach(function (n) {
        if (n) wrap.appendChild(n);
      });
      return wrap;
    }

    // Forms without a team size question have only the add and remove buttons, and the note the admin set for that many teammates.
    var min = field.min == null ? 0 : field.min;
    var max = field.max == null ? range.max - 1 : field.max;
    memberList(field, path, list, min, max, function (next) {
      P.setVal(path, next);
    }).forEach(function (n) {
      if (n) wrap.appendChild(n);
    });
    var note = Rules.teammateNotice(S.form, list.length, App.i18n.lang);
    if (note) wrap.appendChild(P.sizeNote(note));
    return wrap;
  }

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

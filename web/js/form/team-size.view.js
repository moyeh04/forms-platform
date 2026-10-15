/**
 * The team size: the chips of the sizes the form allows, which add or drop
 * member forms, and the note the admin set for a size.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = P.t;
  var root = P.root;
  var S = P.S;

  function sizeField() {
    var f = Rules.fieldByRole(S.form, 'team_size');
    return f && f.enabled !== false ? f : null;
  }

  function membersField() {
    var f = Rules.fieldByRole(S.form, 'members');
    return f && f.enabled !== false ? f : null;
  }

  function freshMember(mf) {
    var fresh = {};
    (mf.fields || []).forEach(function (sf) {
      if (sf.type === 'select' && S.data[sf.id]) fresh[sf.id] = S.data[sf.id];
    });
    return fresh;
  }

  /** Keeps exactly size - 1 member forms; extra ones are dropped from the end. */
  function syncMembers(size) {
    var mf = Rules.fieldByRole(S.form, 'members');
    if (!mf) return;
    var list = Array.isArray(P.getVal(mf.id)) ? P.getVal(mf.id) : [];
    while (list.length > size - 1) list.pop();
    while (list.length < size - 1) list.push(freshMember(mf));
    P.setVal(mf.id, list);
    S.errors = P.dropErrors(mf.id);
    delete S.errors[mf.id];
  }

  function scrollToMembers() {
    var el = root.querySelector('.members-wrap');
    if (el && el.scrollIntoView) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        /* not available */
      }
    }
  }

  function teamSizeControl(field, path, id) {
    var range = Rules.teamSizeRange(S.form);
    var sizes = [];
    for (var n = range.min; n <= range.max; n++) sizes.push(n);
    var cur = P.getVal(path);
    if (sizes.length === 1 && !cur) {
      cur = String(sizes[0]);
      P.setVal(path, cur);
      syncMembers(sizes[0]);
    }
    var pick = function (n) {
      P.setVal(path, String(n));
      delete S.errors[path];
      syncMembers(n);
      P.saveDraft();
      P.render();
      scrollToMembers();
    };
    var note = cur ? Rules.teamSizeNotice(S.form, cur, App.i18n.lang) : '';
    var noteEl = sizeNote(note);
    if (sizes.length > 8) {
      return [
        h(
          'select',
          {
            id: id,
            class: 'select',
            name: path,
            'aria-describedby': id + '-help ' + id + '-err',
            onchange: function (e) {
              if (e.target.value) pick(parseInt(e.target.value, 10));
            }
          },
          h('option', { value: '' }, t('choose')),
          sizes.map(function (n) {
            return h(
              'option',
              { value: String(n), selected: String(cur) === String(n) },
              String(n)
            );
          })
        ),
        noteEl
      ];
    }
    return [
      h(
        'div',
        {
          class: 'chips size-chips',
          role: 'radiogroup',
          id: id,
          'aria-describedby': id + '-help ' + id + '-err'
        },
        sizes.map(function (n) {
          return h(
            'label',
            { class: 'chip' },
            h('input', {
              type: 'radio',
              name: path,
              value: String(n),
              checked: String(cur) === String(n),
              onchange: function () {
                pick(n);
              }
            }),
            h('span', null, String(n))
          );
        })
      ),
      noteEl
    ];
  }

  /** The note the admin set for a team size or a number of teammates, under its control; null when there is none. */
  function sizeNote(text) {
    return text
      ? h(
          'p',
          { class: 'size-notice', role: 'status' },
          icon('info', 18),
          h('span', null, text)
        )
      : null;
  }

  /** A value of the summary with the note of its number after it. */
  function withNote(value, text) {
    return text
      ? h('span', null, value, h('span', { class: 'size-notice-inline' }, text))
      : value;
  }

  P.teamSizeControl = teamSizeControl;
  P.freshMember = freshMember;
  P.sizeField = sizeField;
  P.syncMembers = syncMembers;
  P.sizeNote = sizeNote;
  P.withNote = withNote;
})(window.App);

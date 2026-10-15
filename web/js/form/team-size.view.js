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

  /** The most sizes shown as chips; more take a dropdown. */
  var MAX_SIZE_CHIPS = 8;

  /** The size of the icon before a size note, in pixels. */
  var NOTE_ICON_SIZE = 18;

  /**
   * Finds the team size question, when it is on.
   *
   * @return {?Object} The field, or null.
   */
  function sizeField() {
    var f = Rules.fieldByRole(S.form, 'team_size');
    return f && f.enabled !== false ? f : null;
  }

  /**
   * Makes the answers of a new member. A choice the leader made, such as
   * the specialization, is filled in for the member too.
   *
   * @param {!Object} mf The members question.
   * @return {!Object} The answers.
   */
  function freshMember(mf) {
    var fresh = {};
    (mf.fields || []).forEach(function (sf) {
      if (sf.type === 'select' && S.data[sf.id]) fresh[sf.id] = S.data[sf.id];
    });
    return fresh;
  }

  /**
   * Keeps exactly size - 1 member forms; extra ones are dropped from the
   * end.
   *
   * @param {number} size The team size, leader included.
   */
  function syncMembers(size) {
    var mf = Rules.fieldByRole(S.form, 'members');
    if (!mf) return;
    var kept = P.getVal(mf.id);
    var list = Array.isArray(kept) ? kept : [];
    while (list.length > size - 1) list.pop();
    while (list.length < size - 1) list.push(freshMember(mf));
    P.setVal(mf.id, list);
    S.errors = P.dropErrors(mf.id);
    delete S.errors[mf.id];
  }

  /** Scrolls to the member forms. */
  function scrollToMembers() {
    var el = root.querySelector('.members-wrap');
    if (!el?.scrollIntoView) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      /* not available */
    }
  }

  /**
   * Lists the sizes the form allows.
   *
   * @return {!Array<number>} The sizes, smallest first.
   */
  function allowedSizes() {
    var range = Rules.teamSizeRange(S.form);
    var sizes = [];
    for (let n = range.min; n <= range.max; n++) sizes.push(n);
    return sizes;
  }

  /**
   * Keeps a picked size, sets the member forms to it and scrolls to them.
   *
   * @param {string} path The path of the size.
   * @param {number} n The size.
   */
  function pickSize(path, n) {
    P.setVal(path, String(n));
    delete S.errors[path];
    syncMembers(n);
    P.saveDraft();
    P.render();
    scrollToMembers();
  }

  /**
   * Draws many sizes as a dropdown.
   *
   * @param {!Array<number>} sizes The sizes.
   * @param {string} path The path of the size.
   * @param {string} id The id of the control.
   * @param {*} cur The size now.
   * @return {!Element} The dropdown.
   */
  function sizeDropdown(sizes, path, id, cur) {
    return h(
      'select',
      {
        id: id,
        class: 'select',
        name: path,
        'aria-describedby': id + '-help ' + id + '-err',
        onchange: function (e) {
          if (e.target.value) pickSize(path, parseInt(e.target.value, 10));
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
    );
  }

  /**
   * Draws a few sizes as chips.
   *
   * @param {!Array<number>} sizes The sizes.
   * @param {string} path The path of the size.
   * @param {string} id The id of the control.
   * @param {*} cur The size now.
   * @return {!Element} The chips.
   */
  function sizeChips(sizes, path, id, cur) {
    return h(
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
              pickSize(path, n);
            }
          }),
          h('span', null, String(n))
        );
      })
    );
  }

  /**
   * Draws the team size question, with the note of the size picked. A
   * single allowed size is picked for the student.
   *
   * @param {!Object} _field The question; its sizes are the form's rules.
   * @param {string} path The path of its answer.
   * @param {string} id The id of the control.
   * @return {!Array<?Element>} The control and the note.
   */
  function teamSizeControl(_field, path, id) {
    var sizes = allowedSizes();
    var cur = P.getVal(path);
    if (sizes.length === 1 && !cur) {
      cur = String(sizes[0]);
      P.setVal(path, cur);
      syncMembers(sizes[0]);
    }
    var note = cur ? Rules.teamSizeNotice(S.form, cur, App.i18n.lang) : '';
    var control =
      sizes.length > MAX_SIZE_CHIPS
        ? sizeDropdown(sizes, path, id, cur)
        : sizeChips(sizes, path, id, cur);
    return [control, sizeNote(note)];
  }

  /**
   * Draws the note the admin set for a team size or a number of teammates,
   * under its control.
   *
   * @param {string} text The note.
   * @return {?Element} The note, or null when there is none.
   */
  function sizeNote(text) {
    if (!text) return null;
    return h(
      'p',
      { class: 'size-notice', role: 'status' },
      icon('info', NOTE_ICON_SIZE),
      h('span', null, text)
    );
  }

  /**
   * Draws a value of the summary with the note of its number after it.
   *
   * @param {*} value The value.
   * @param {string} text The note.
   * @return {*} The value, with the note when there is one.
   */
  function withNote(value, text) {
    if (!text) return value;
    return h(
      'span',
      null,
      value,
      h('span', { class: 'size-notice-inline' }, text)
    );
  }

  P.teamSizeControl = teamSizeControl;
  P.freshMember = freshMember;
  P.sizeField = sizeField;
  P.syncMembers = syncMembers;
  P.sizeNote = sizeNote;
  P.withNote = withNote;
})(window.App);

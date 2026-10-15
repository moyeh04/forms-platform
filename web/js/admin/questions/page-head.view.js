/**
 * The parts of the Questions list that are not questions: the heading of
 * a page, and the picker of the list a choice question reads.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var Q = A.questions;
  var h = App.ui.h;
  var icon = App.ui.icon;

  /**
   * Draws a button that moves a page up or down.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} st The page.
   * @param {number} n Its place.
   * @param {number} by -1 for up, 1 for down.
   * @return {!Element} The button.
   */
  function pageMove(s, st, n, by) {
    var up = by < 0;
    return h(
      'button',
      {
        type: 'button',
        class: 'icon-btn sm',
        name: (up ? 'page-up-' : 'page-down-') + st.id,
        'aria-label': 'Move page ' + (n + 1) + (up ? ' up' : ' down'),
        disabled: up ? n === 0 : n === s.f.steps.length - 1,
        onclick: function () {
          s.f.steps.splice(n, 1);
          s.f.steps.splice(n + by, 0, st);
          s.paintQuestions();
        }
      },
      up ? '↑' : '↓'
    );
  }

  /**
   * Draws the Remove button of a page. A page is removed only when nothing
   * is on it, so removing a page never removes a question.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} st The page.
   * @param {number} n Its place.
   * @return {?Element} The button, or null while it has questions or is
   *     the only page.
   */
  function pageRemove(s, st, n) {
    if ((st.fields || []).length || s.f.steps.length <= 1) return null;
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm danger',
        name: 'remove-page-' + st.id,
        onclick: function () {
          s.f.steps.splice(n, 1);
          s.paintQuestions();
        }
      },
      icon('trash', A.ICON_SIZE.MENU),
      'Remove page'
    );
  }

  /**
   * Draws the heading of a page: its number, its title in both languages,
   * its place among the pages, and Remove while it is empty.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} st The page; a missing title is filled in.
   * @param {number} n Its place.
   * @return {!Element} The heading.
   */
  Q.pageHead = function (s, st, n) {
    st.title = st.title || { en: st.id, ar: st.id };
    return h(
      'div',
      { class: 'q-page', dataset: { page: st.id } },
      h('span', { class: 'tt-num' }, String(n + 1)),
      h(
        'div',
        { class: 'q-labels' },
        A.text(
          st.title.en,
          function (v) {
            st.title.en = v;
          },
          {
            name: 'page-title-en-' + st.id,
            'aria-label': 'English title of page ' + (n + 1),
            placeholder: 'Page title, in English'
          }
        ),
        A.text(
          st.title.ar,
          function (v) {
            st.title.ar = v;
          },
          {
            name: 'page-title-ar-' + st.id,
            'aria-label': 'Arabic title of page ' + (n + 1),
            dir: 'rtl',
            lang: 'ar',
            placeholder: 'عنوان الصفحة'
          }
        )
      ),
      h(
        'div',
        { class: 'q-opts' },
        pageMove(s, st, n, -1),
        pageMove(s, st, n, 1),
        pageRemove(s, st, n)
      )
    );
  };

  /**
   * Points a question at another list. The leader's section and the
   * members' section share an id, so they move together.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} fd The question.
   * @param {string} key The list.
   */
  function pointAt(s, fd, key) {
    var old = fd.list;
    (s.f.fields || []).forEach(function (x) {
      [x].concat(x.fields || []).forEach(function (y) {
        if (y.id === fd.id && y.list === old) y.list = key;
      });
    });
    fd.list = key;
    s.paintSectionRule();
    s.paintQuestions();
  }

  /**
   * Draws which list a question reads, among the lists of the same kind.
   *
   * @param {!Object} s The settings page: `f` and `res`.
   * @param {!Object} fd The question.
   * @return {?Element} The picker; null when there is no other list to
   *     pick.
   */
  Q.listPicker = function (s, fd) {
    if (!fd.list) return null;
    var info = s.res.listInfo;
    var kind = A.listKind(fd.list, info);
    var same = Object.keys(s.res.lists || {}).filter(function (k) {
      return (
        k === fd.list ||
        (A.listSwappable(k) &&
          A.listSwappable(fd.list) &&
          A.listKind(k, info) === kind)
      );
    });
    if (same.length < 2) return null;
    var sel = A.select(
      fd.list,
      same.map(function (k) {
        return [k, A.listName(k, info)];
      }),
      function (v) {
        pointAt(s, fd, v);
      }
    );
    sel.setAttribute('name', 'list-' + fd.id);
    sel.setAttribute('aria-label', 'List for ' + fd.label.en);
    return h(
      'label',
      { class: 'q-list-pick' },
      h('span', { class: 'muted-note' }, 'Choices from'),
      sel
    );
  };
})(window.App);

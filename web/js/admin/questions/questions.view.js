/**
 * The Questions panel of a form: each page and its questions, in the order
 * students meet them, then the questions on no page, then Add a page.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var Q = A.questions;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  var HELP =
    'Each page of the form and its questions, in the order students see' +
    ' them. Rename a page, add a page, or move a question to another page' +
    ' with Page. Rename a question, hide it, make it required, or give it a' +
    ' description. Add your own questions to any page. Team size, names,' +
    ' codes, and the booking slot are always required. For names, the' +
    ' number is how many name parts are needed (4 means a four-part name).';

  /**
   * Puts the focus on a control of the list, once it is drawn.
   *
   * @param {!Object} s The settings page.
   * @param {string} selector The control.
   */
  function focus(s, selector) {
    var input = s.qList.querySelector(selector);
    if (input?.focus) input.focus();
  }

  /**
   * Draws the button that adds a question to a page.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} st The page.
   * @return {!Element} The button.
   */
  function addQuestionButton(s, st) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm q-add',
        name: 'add-question-' + st.id,
        onclick: function () {
          var id = Q.addQuestion(s.f, st);
          s.toolsOpen[id] = true;
          s.paintQuestions();
          focus(s, '[data-field="' + id + '"] input[type="text"]');
        }
      },
      icon('plus', A.ICON_SIZE.MENU),
      'Add a question to this page'
    );
  }

  /**
   * Draws a page: its heading, its questions, and the button that adds
   * one.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} c The list: `listed`, the questions, and `placed`,
   *     the ids drawn so far, which this fills in.
   * @param {!Object} st The page.
   * @param {number} n Its place.
   * @return {!Array<?Element>} The rows.
   */
  function pageRows(s, c, st, n) {
    var mine = (st.fields || [])
      .map(function (id) {
        return c.listed.filter(function (fd) {
          return fd.id === id;
        })[0];
      })
      .filter(Boolean);
    var rows = [Q.pageHead(s, st, n)];
    mine.forEach(function (fd) {
      c.placed[fd.id] = true;
      rows = rows.concat(Q.rows(s, fd, false));
    });
    if (!mine.length) {
      rows.push(
        h(
          'p',
          { class: 'muted-note q-empty' },
          'This page has no questions yet. Students do not see a page with' +
            ' no questions.'
        )
      );
    }
    rows.push(addQuestionButton(s, st));
    return rows;
  }

  /**
   * Draws the questions that are on no page, under their heading.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} c The list.
   * @return {!Array<?Element>} The rows.
   */
  function looseRows(s, c) {
    var loose = c.listed.filter(function (fd) {
      return !c.placed[fd.id];
    });
    var rows = [];
    if (loose.length && (s.f.steps || []).length) {
      rows.push(
        h(
          'h3',
          { class: 'q-page', dataset: { page: '' } },
          'Not on a page (students do not see these)'
        )
      );
    }
    loose.forEach(function (fd) {
      rows = rows.concat(Q.rows(s, fd, false));
    });
    return rows;
  }

  /**
   * Draws the button that adds a page.
   *
   * @param {!Object} s The settings page.
   * @return {!Element} The button.
   */
  function addPageButton(s) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet q-add-page',
        name: 'add-page',
        onclick: function () {
          var st = Q.addPage(s.f);
          s.paintQuestions();
          focus(s, '[name="page-title-en-' + st.id + '"]');
        }
      },
      icon('plus', A.ICON_SIZE.LINE),
      'Add a page'
    );
  }

  /**
   * Draws the list again.
   *
   * @param {!Object} s The settings page.
   */
  function paint(s) {
    var c = { listed: Q.listed(s), placed: {} };
    var rows = [];
    (s.f.steps || []).forEach(function (st, n) {
      rows = rows.concat(pageRows(s, c, st, n));
    });
    rows = rows.concat(looseRows(s, c), [addPageButton(s)]);
    ui.clear(s.qList);
    rows.forEach(function (n) {
      if (n) s.qList.appendChild(n);
    });
  }

  /**
   * Draws the Questions panel. It sets `qList`, `toolsOpen` and
   * `paintQuestions()` on the settings page.
   *
   * @param {!Object} s The settings page: `f`, `res`, `isReservation`,
   *     `paintSectionRule()`.
   * @return {!Element} The panel.
   */
  A.questionsPanel = function (s) {
    s.qList = h('div', { class: 'q-list' });
    s.toolsOpen = {};
    s.paintQuestions = paint.bind(null, s);
    s.paintQuestions();
    var panel = A.panel('Questions', HELP, s.qList);
    panel.summary = Q.summary.bind(null, s);
    return panel;
  };
})(window.App);

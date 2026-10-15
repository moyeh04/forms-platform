/**
 * The tools of a question: the page it is on, its order on the page, and
 * for a question the admin added, its kind of answer, its choices and
 * Remove. Folded until asked for, to keep the list short.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var Q = A.questions;
  var h = App.ui.h;
  var icon = App.ui.icon;

  /**
   * Draws a tool with its label.
   *
   * @param {string} tag 'label' when it wraps a control, else 'span'.
   * @param {string} label The label.
   * @param {...*} body The control.
   * @return {!Element} The tool.
   */
  function tool(tag, label, ...body) {
    return h(
      tag,
      { class: 'q-tool' },
      h('span', { class: 'tool-label' }, label),
      body
    );
  }

  /**
   * Draws the page a question is on, as a select of the pages.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} fd The question.
   * @return {!Element} The tool.
   */
  function pageTool(s, fd) {
    var sel = A.select(
      Q.pageOf(s.f, fd).id,
      s.f.steps.map(function (st, n) {
        return [st.id, n + 1 + '. ' + Q.pageName(st)];
      }),
      function (v) {
        Q.moveToPage(s.f, fd, v);
        s.paintQuestions();
      }
    );
    sel.name = 'page-' + fd.id;
    return tool('label', 'Page', sel);
  }

  /**
   * Draws a button that moves a question up or down on its page.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} fd The question.
   * @param {number} by -1 for up, 1 for down.
   * @return {!Element} The button.
   */
  function orderButton(s, fd, by) {
    var up = by < 0;
    var list = Q.pageOf(s.f, fd).fields;
    var at = list.indexOf(fd.id);
    return h(
      'button',
      {
        type: 'button',
        class: 'icon-btn sm',
        name: (up ? 'up-' : 'down-') + fd.id,
        'aria-label': up ? 'Move up' : 'Move down',
        disabled: up ? at === 0 : at === list.length - 1,
        onclick: function () {
          if (Q.shift(s.f, fd, by)) s.paintQuestions();
        }
      },
      up ? '↑' : '↓'
    );
  }

  /**
   * Draws the kind of answer of an added question.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} fd The question.
   * @return {!Element} The tool.
   */
  function kindTool(s, fd) {
    var sel = A.select(fd.type, Q.KINDS, function (v) {
      fd.type = v;
      if (v !== 'select') delete fd.options;
      s.paintQuestions();
    });
    sel.name = 'kind-' + fd.id;
    return tool('label', 'Kind of answer', sel);
  }

  /**
   * Draws the Remove button of an added question.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} fd The question.
   * @return {!Element} The button.
   */
  function removeButton(s, fd) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm danger',
        name: 'remove-' + fd.id,
        title:
          'Answers already given stay in the Google Sheet but are no longer' +
          ' shown.',
        onclick: function () {
          Q.removeQuestion(s.f, fd);
          s.paintQuestions();
        }
      },
      icon('trash', A.ICON_SIZE.MENU),
      'Remove question'
    );
  }

  /**
   * Draws the choices of an added choice question, one on each line.
   *
   * @param {!Object} fd The question.
   * @return {!Element} The field.
   */
  function choicesField(fd) {
    return h(
      'label',
      { class: 'field-row q-choices' },
      h('span', { class: 'label' }, 'Choices, one on each line'),
      h(
        'textarea',
        {
          class: 'textarea',
          rows: '4',
          name: 'choices-' + fd.id,
          placeholder: 'Yes\nNo\nTo add the Arabic text: Yes | نعم',
          oninput: function (e) {
            fd.options = Q.readChoices(e.target.value);
          }
        },
        Q.choicesText(fd.options)
      )
    );
  }

  /**
   * Draws the tools of a question.
   *
   * @param {!Object} s The settings page: `f`, `toolsOpen`,
   *     `paintQuestions()`.
   * @param {!Object} fd The question.
   * @return {?Element} The tools; null when it has none.
   */
  Q.toolsRow = function (s, fd) {
    var movable = Q.isMovable(s.f, fd);
    if (!movable && !fd.custom) return null;
    return h(
      'div',
      {
        class: 'q-tools',
        dataset: { tools: fd.id },
        hidden: !s.toolsOpen[fd.id]
      },
      movable ? pageTool(s, fd) : null,
      movable
        ? tool('span', 'Order', orderButton(s, fd, -1), orderButton(s, fd, 1))
        : null,
      fd.custom ? kindTool(s, fd) : null,
      fd.custom ? removeButton(s, fd) : null,
      fd.custom && fd.type === 'select' ? choicesField(fd) : null
    );
  };
})(window.App);

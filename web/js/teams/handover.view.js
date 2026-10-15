/**
 * The question asked before the leader of a team moves to another team:
 * who leads the team next, and that student's email when the form asks a
 * leader for one. The leader answers it on the student page and the admin
 * on the dashboard, so it is drawn here once.
 */
(function (App) {
  'use strict';

  var h = App.ui.h;

  /**
   * Shows a reason under a field, or hides it.
   *
   * @param {!Element} field The field, holding a `.error` line.
   * @param {string} text The reason, or '' to hide it.
   * @return {string} The same reason.
   */
  function showError(field, text) {
    var err = field.querySelector('.error');
    field.classList.toggle('has-error', !!text);
    err.hidden = !text;
    err.textContent = text;
    return text;
  }

  /**
   * Makes the error line of a field.
   *
   * @return {!Element} The line, hidden.
   */
  function errorLine() {
    return h('p', { class: 'error', role: 'alert', hidden: true });
  }

  /**
   * Makes the choice of the next leader, one chip per member who can lead.
   *
   * @param {!Object} o The question, as App.handover takes it.
   * @param {{chosen: string}} state The code chosen; a chip changes it.
   * @return {!Element} The field.
   */
  function whoField(o, state) {
    var field = h(
      'div',
      { class: 'field' },
      h('span', { class: 'label', id: 'handover-who' }, o.words.who)
    );
    var chips = o.heirs.map(function (m) {
      return h(
        'label',
        { class: 'chip' },
        h('input', {
          type: 'radio',
          name: 'handover-leader',
          value: m.code,
          checked: m.code === state.chosen,
          onchange: function () {
            state.chosen = m.code;
            showError(field, '');
          }
        }),
        h('span', { dir: 'auto' }, m.name || m.code)
      );
    });
    field.appendChild(
      h(
        'div',
        {
          class: 'chips',
          role: 'radiogroup',
          'aria-labelledby': 'handover-who'
        },
        chips
      )
    );
    field.appendChild(errorLine());
    return field;
  }

  /**
   * Makes the email question of the next leader.
   *
   * @param {!Object} o The question, as App.handover takes it.
   * @return {{field: !Element, input: !Element}} The field and its box.
   */
  function emailField(o) {
    var field;
    var input = h('input', {
      class: 'input',
      type: 'email',
      id: 'handover-email',
      name: 'handover-email',
      dir: 'ltr',
      autocomplete: 'off',
      oninput: function () {
        showError(field, '');
      }
    });
    field = h(
      'div',
      { class: 'field' },
      h('label', { class: 'label', for: 'handover-email' }, o.words.email),
      input,
      errorLine()
    );
    return { field: field, input: input };
  }

  /**
   * Draws the question.
   *
   * @param {!Object} o `heirs`: `[{code, name}]`, the members who can lead.
   *     `email`: the email question of the form, or null. `words`: `{who,
   *     email, choose, error(code)}`, where `error(code)` is the text for a
   *     refused email.
   * @return {!Object} `{node, value(), problem()}`: `value()` is `{leader,
   *     email}`; `problem()` shows each reason next to its answer and
   *     returns the first one, or ''.
   */
  function handover(o) {
    var state = { chosen: o.heirs.length === 1 ? o.heirs[0].code : '' };
    var who = whoField(o, state);
    var mail = o.email ? emailField(o) : null;
    var input = mail ? mail.input : null;

    return {
      node: h('div', { class: 'handover' }, who, mail ? mail.field : null),
      /**
       * Reads the answers.
       *
       * @return {{leader: string, email: string}} The answers.
       */
      value: function () {
        return { leader: state.chosen, email: input ? input.value.trim() : '' };
      },
      /**
       * Shows each reason next to its answer.
       *
       * @return {string} The first reason, or '' when both are answered.
       */
      problem: function () {
        var checked = input
          ? Rules.validateField(o.email, input.value)
          : { ok: true };
        var first = showError(who, state.chosen ? '' : o.words.choose);
        var reason = checked.ok ? '' : o.words.error(checked.error);
        var second = mail ? showError(mail.field, reason) : '';
        return first || second;
      }
    };
  }

  App.handover = handover;
})(window.App);

/**
 * The question asked before the leader of a team moves to another team: who leads the team next,
 * and that student's email when the form asks a leader for one. The leader answers it on the
 * student page and the admin on the dashboard, so it is drawn here once.
 */
(function (App) {
  'use strict';

  var h = App.ui.h;

  /**
   * o.heirs: [{ code, name }], the members who can lead. o.email: the email question of the form, or null.
   * o.words: { who, email, choose, error(code) }; error(code) is the text for a refused email.
   * Returns { node, value(), problem() }: value() is { leader, email }; problem() shows each reason
   * next to its answer and returns the first one, or ''.
   */
  App.handover = function (o) {
    var w = o.words;
    var chosen = o.heirs.length === 1 ? o.heirs[0].code : '';
    var show = function (field, text) {
      var err = field.querySelector('.error');
      field.classList.toggle('has-error', !!text);
      err.hidden = !text;
      err.textContent = text;
      return text;
    };
    var who = h('div', { class: 'field' },
      h('span', { class: 'label', id: 'handover-who' }, w.who),
      h('div', { class: 'chips', role: 'radiogroup', 'aria-labelledby': 'handover-who' }, o.heirs.map(function (m) {
        return h('label', { class: 'chip' },
          h('input', { type: 'radio', name: 'handover-leader', value: m.code, checked: m.code === chosen, onchange: function () { chosen = m.code; show(who, ''); } }),
          h('span', { dir: 'auto' }, m.name || m.code));
      })),
      h('p', { class: 'error', role: 'alert', hidden: true }));
    var input = o.email ? h('input', { class: 'input', type: 'email', id: 'handover-email', name: 'handover-email', dir: 'ltr', autocomplete: 'off', oninput: function () { show(mail, ''); } }) : null;
    var mail = input ? h('div', { class: 'field' },
      h('label', { class: 'label', for: 'handover-email' }, w.email),
      input,
      h('p', { class: 'error', role: 'alert', hidden: true })) : null;

    return {
      node: h('div', { class: 'handover' }, who, mail),
      value: function () { return { leader: chosen, email: input ? input.value.trim() : '' }; },
      problem: function () {
        var checked = input ? Rules.validateField(o.email, input.value) : { ok: true };
        var first = show(who, chosen ? '' : w.choose);
        var second = mail ? show(mail, checked.ok ? '' : w.error(checked.error)) : '';
        return first || second;
      }
    };
  };
})(window.App);

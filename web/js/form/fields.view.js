/**
 * A question as it is drawn: its label, description, control and error, the
 * folder naming rule under a Drive folder question, and checking one answer
 * when it is left.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = P.t;
  var L = P.L;
  var root = P.root;
  var S = P.S;

  function fid(path) {
    return 'f-' + path.replace(/\./g, '-');
  }

  function renderField(field, path) {
    var id = fid(path);
    var control;
    switch (field.type) {
      case 'team_size':
        control = P.teamSizeControl(field, path, id);
        break;
      case 'members':
        control = P.membersControl(field, path);
        break;
      case 'slot':
        control = P.slotControl(field, path, id);
        break;
      case 'select':
        control = P.selectControl(field, path, id);
        break;
      case 'textarea':
        control = P.textControl(field, path, id);
        break;
      default:
        control = P.textControl(field, path, id);
    }
    var optional = field.required === false;
    var help = field.help ? L(field.help) : '';
    var node = h(
      'div',
      { class: 'field', dataset: { path: path } },
      h(
        'label',
        {
          class: 'label' + (field.type === 'members' ? ' sr-only' : ''),
          for:
            field.type === 'select' && (field.options || []).length <= 4
              ? null
              : id
        },
        L(field.label),
        optional ? h('span', { class: 'opt' }, '(' + t('optional') + ')') : null
      ),
      // The description sits between the question and the answer, where it is read first.
      help
        ? h('p', { class: 'help field-desc', id: id + '-help' }, help)
        : null,
      control,
      folderRule(field),
      h('p', { class: 'error', id: id + '-err', role: 'alert', hidden: true })
    );
    if (S.errors[path]) paintErrorNode(node, S.errors[path]);
    return node;
  }

  /** The folder naming rule under a Drive folder question, with an example from the project title. */
  function folderExample() {
    var fn = S.form.rules && S.form.rules.folderName;
    return Rules.folderNameExample({
      project: Rules.valueByRole(S.form, S.data, 'title'),
      subject: fn && fn.subject
    });
  }

  function folderRule(field) {
    var fn = S.form.rules && S.form.rules.folderName;
    if (
      !fn ||
      !fn.enabled ||
      field.type !== 'drive_link' ||
      (field.kinds && field.kinds.indexOf('folder') === -1)
    )
      return null;
    return h(
      'p',
      { class: 'folder-rule' },
      icon('info', 16),
      h(
        'span',
        { class: 'folder-rule-text' },
        t('folderRule', { example: folderExample() })
      )
    );
  }

  function paintFolderRule() {
    var el = root.querySelector('.folder-rule-text');
    if (el) el.textContent = t('folderRule', { example: folderExample() });
  }

  function paintErrorNode(node, err) {
    var p = node.querySelector(':scope > .error');
    if (!p) return;
    if (err) {
      node.classList.add('has-error');
      p.textContent = App.i18n.err(err);
      p.hidden = false;
    } else {
      node.classList.remove('has-error');
      p.textContent = '';
      p.hidden = true;
    }
  }

  function paintError(path) {
    var node = root.querySelector('[data-path="' + path + '"]');
    if (node) paintErrorNode(node, S.errors[path]);
  }

  function hint(input, text) {
    var field = input.closest('.field');
    if (!field) return;
    var old = field.querySelector(':scope > .hint');
    if (old) old.remove();
    var el = h('p', { class: 'hint', role: 'status' }, text);
    field.insertBefore(el, field.querySelector(':scope > .error'));
    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, 2400);
  }

  function validateOne(field, path) {
    var v = Rules.validateField(field, P.getVal(path), { form: S.form });
    if (v.ok) delete S.errors[path];
    else S.errors[path] = { error: v.error, params: v.params };
    paintError(path);
  }

  P.renderField = renderField;
  P.hint = hint;
  P.paintFolderRule = paintFolderRule;
  P.paintError = paintError;
  P.validateOne = validateOne;
})(window.App);

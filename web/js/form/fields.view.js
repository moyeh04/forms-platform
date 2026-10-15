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

  /** How long a typing hint stays, in milliseconds. */
  var HINT_MS = 2400;

  /** The size of the icon before the folder rule, in pixels. */
  var RULE_ICON_SIZE = 16;

  /** The part that draws the control of each field type; text otherwise. */
  var CONTROLS = {
    team_size: 'teamSizeControl',
    members: 'membersControl',
    slot: 'slotControl',
    select: 'selectControl'
  };

  /**
   * Gives the element id of an answer.
   *
   * @param {string} path The path of the answer.
   * @return {string} The id.
   */
  function fid(path) {
    return 'f-' + path.replace(/\./g, '-');
  }

  /**
   * Draws the label of a question. Chips have no single box to point at,
   * and a members list is labelled by its cards.
   *
   * @param {!Object} field The question.
   * @param {string} id The id of its control.
   * @return {!Element} The label.
   */
  function fieldLabel(field, id) {
    var chips = field.type === 'select' && P.usesChips(field);
    return h(
      'label',
      {
        class: 'label' + (field.type === 'members' ? ' sr-only' : ''),
        for: chips ? null : id
      },
      L(field.label),
      field.required === false
        ? h('span', { class: 'opt' }, '(' + t('optional') + ')')
        : null
    );
  }

  /**
   * Draws a question: its label, its description between the question and
   * the answer, where it is read first, its control, the folder rule and
   * its error.
   *
   * @param {!Object} field The question.
   * @param {string} path The path of its answer.
   * @return {!Element} The field.
   */
  function renderField(field, path) {
    var id = fid(path);
    var control = P[CONTROLS[field.type] || 'textControl'](field, path, id);
    var help = field.help ? L(field.help) : '';
    var node = h(
      'div',
      { class: 'field', dataset: { path: path } },
      fieldLabel(field, id),
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

  /**
   * Gives the folder naming rule of the form.
   *
   * @return {?Object} The rule, or null.
   */
  function folderName() {
    var rules = S.form.rules || {};
    return rules.folderName || null;
  }

  /**
   * Writes an example folder name from the project title.
   *
   * @return {string} The example.
   */
  function folderExample() {
    var fn = folderName();
    return Rules.folderNameExample({
      project: Rules.valueByRole(S.form, S.data, 'title'),
      subject: fn?.subject
    });
  }

  /**
   * Says whether a question shows the folder naming rule: a Drive link
   * that may be a folder, on a form with the rule on.
   *
   * @param {!Object} field The question.
   * @return {boolean} True in that case.
   */
  function showsFolderRule(field) {
    var fn = folderName();
    if (!fn?.enabled || field.type !== 'drive_link') return false;
    return !field.kinds || field.kinds.indexOf('folder') !== -1;
  }

  /**
   * Draws the folder naming rule under a Drive folder question, with an
   * example from the project title.
   *
   * @param {!Object} field The question.
   * @return {?Element} The rule, or null.
   */
  function folderRule(field) {
    if (!showsFolderRule(field)) return null;
    return h(
      'p',
      { class: 'folder-rule' },
      icon('info', RULE_ICON_SIZE),
      h(
        'span',
        { class: 'folder-rule-text' },
        t('folderRule', { example: folderExample() })
      )
    );
  }

  /** Writes the folder rule again after the project title changed. */
  function paintFolderRule() {
    var el = root.querySelector('.folder-rule-text');
    if (el) el.textContent = t('folderRule', { example: folderExample() });
  }

  /**
   * Shows the error of a field, or hides it.
   *
   * @param {!Element} node The field.
   * @param {?Object} err The error, or null.
   */
  function paintErrorNode(node, err) {
    var p = node.querySelector(':scope > .error');
    if (!p) return;
    node.classList.toggle('has-error', !!err);
    p.textContent = err ? App.i18n.err(err) : '';
    p.hidden = !err;
  }

  /**
   * Shows the kept error of an answer on its field.
   *
   * @param {string} path The path of the answer.
   */
  function paintError(path) {
    var node = root.querySelector('[data-path="' + path + '"]');
    if (node) paintErrorNode(node, S.errors[path]);
  }

  /**
   * Shows a short note under a box, such as why a letter was taken out. It
   * goes away by itself.
   *
   * @param {!Element} input The box.
   * @param {string} text The note.
   */
  function hint(input, text) {
    var field = input.closest('.field');
    if (!field) return;
    var old = field.querySelector(':scope > .hint');
    if (old) old.remove();
    var el = h('p', { class: 'hint', role: 'status' }, text);
    field.insertBefore(el, field.querySelector(':scope > .error'));
    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, HINT_MS);
  }

  /**
   * Checks one answer and shows its error.
   *
   * @param {!Object} field The question.
   * @param {string} path The path of the answer.
   */
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

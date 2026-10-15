/**
 * Typed answers: the text box of each field type, its placeholder, and the
 * filter that removes what the type does not allow while the student types or
 * pastes.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  /** Arabic letters, which an English answer may not hold. */
  var ARABIC = /[\u0600-\u06FF\u0750-\u077F]/g;

  /**
   * A hint of the shape of an answer. It must not read as an answer that
   * is already there.
   */
  var PLACEHOLDERS = {
    email: 'name@example.com',
    phone: '01xxxxxxxxx',
    drive_link: 'https://drive.google.com/...'
  };

  /** The browser input type of each field type; text otherwise. */
  var INPUT_TYPES = { email: 'email', phone: 'tel', drive_link: 'url' };

  /** The keyboard and autofill hints of each field type. */
  var TYPE_ATTRS = {
    arabic_name: { lang: 'ar', dir: 'rtl', autocomplete: 'name' },
    code: { inputmode: 'numeric' },
    phone: { inputmode: 'tel', autocomplete: 'tel' },
    email: { inputmode: 'email', autocomplete: 'email', autocapitalize: 'off' }
  };

  /**
   * Keeps the Arabic letters of a name.
   *
   * @param {string} before The typed text.
   * @return {{after: string, message: string}} The text and why it changed.
   */
  function filterArabic(before) {
    var c = Rules.cleanArabicName(before, false);
    return { after: c.value, message: c.blocked ? t('hintArabic') : '' };
  }

  /**
   * Takes the Arabic letters out of an English answer.
   *
   * @param {string} before The typed text.
   * @return {{after: string, message: string}} The text and why it changed.
   */
  function filterEnglish(before) {
    var after = before.replace(ARABIC, '');
    return { after: after, message: after !== before ? t('hintEnglish') : '' };
  }

  /**
   * Keeps the digits of a student code, no more than it has.
   *
   * @param {string} before The typed text.
   * @param {!Object} field The question.
   * @return {{after: string, message: string}} The text and why it changed.
   */
  function filterCode(before, field) {
    var digits = Rules.latinDigits(before).replace(/\s+/g, '');
    var only = digits.replace(/\D/g, '');
    return {
      after: only.slice(0, Rules.codeLength(field)),
      message: only !== digits ? t('hintDigits') : ''
    };
  }

  /**
   * Keeps what a phone number may hold: digits, +, spaces, dashes and
   * brackets.
   *
   * @param {string} before The typed text.
   * @return {{after: string, message: string}} The text and why it changed.
   */
  function filterPhone(before) {
    var d = Rules.latinDigits(before);
    var after = d.replace(/[^\d+\s\-()]/g, '');
    return { after: after, message: after !== d ? t('hintDigits') : '' };
  }

  /**
   * Removes what a field type does not allow.
   *
   * @param {!Object} field The question.
   * @param {string} before The typed text.
   * @return {{after: string, message: string}} The text and why it changed.
   */
  function filtered(field, before) {
    switch (field.type) {
      case 'arabic_name':
        return filterArabic(before);
      case 'english_text':
        return filterEnglish(before);
      case 'code':
        return filterCode(before, field);
      case 'phone':
        return filterPhone(before);
      default:
        return { after: before, message: '' };
    }
  }

  /**
   * Puts the cleaned text in a box and keeps the caret where it was, less
   * what was taken out.
   *
   * @param {!Element} input The box.
   * @param {string} before The typed text.
   * @param {string} after The cleaned text.
   */
  function replaceText(input, before, after) {
    var pos = input.selectionStart;
    input.value = after;
    var at = pos == null ? after.length : pos;
    var caret = Math.max(0, at - (before.length - after.length));
    try {
      input.setSelectionRange(caret, caret);
    } catch {
      /* not all inputs */
    }
  }

  /**
   * Removes what a field type does not allow while the person types or
   * pastes, says why, and keeps the answer.
   *
   * @param {!Object} field The question.
   * @param {!Element} input The box.
   * @param {string} path The path of the answer.
   */
  function liveFilter(field, input, path) {
    var before = input.value;
    var f = filtered(field, before);
    if (f.after !== before) replaceText(input, before, f.after);
    if (f.message) P.hint(input, f.message);
    P.setVal(path, input.value);
    if (field.role === 'title') P.paintFolderRule();
    if (S.errors[path]) {
      delete S.errors[path];
      P.paintError(path);
    }
  }

  /**
   * Gives the attributes of the box of a question.
   *
   * @param {!Object} field The question.
   * @param {string} path The path of its answer.
   * @param {string} id The id of the box.
   * @return {!Object} The attributes.
   */
  function textAttrs(field, path, id) {
    var value = P.getVal(path);
    var attrs = {
      id: id,
      class: field.type === 'textarea' ? 'textarea' : 'input',
      name: path,
      value: value == null ? '' : String(value),
      'aria-describedby': id + '-help ' + id + '-err',
      autocomplete: 'off',
      placeholder: PLACEHOLDERS[field.type] || null
    };
    if (field.type === 'textarea') return attrs;
    attrs.type = INPUT_TYPES[field.type] || 'text';
    attrs.dir = 'ltr';
    Object.assign(attrs, TYPE_ATTRS[field.type]);
    if (field.type === 'code')
      attrs.maxlength = String(Rules.codeLength(field));
    return attrs;
  }

  /**
   * Writes a phone number the standard way and checks an answer that was
   * typed, or that had an error, when the box is left.
   *
   * @param {!Object} field The question.
   * @param {!Element} input The box.
   * @param {string} path The path of the answer.
   */
  function leave(field, input, path) {
    var phone = field.type === 'phone' && Rules.normalizePhone(input.value);
    if (phone) {
      input.value = phone;
      P.setVal(path, phone);
    }
    if (input.value.trim() !== '' || S.errors[path]) {
      P.validateOne(field, path);
    }
  }

  /**
   * Draws a question answered by typing.
   *
   * @param {!Object} field The question.
   * @param {string} path The path of its answer.
   * @param {string} id The id of the box.
   * @return {!Element} The box.
   */
  function textControl(field, path, id) {
    var attrs = textAttrs(field, path, id);
    var isArea = field.type === 'textarea';
    var input = h(isArea ? 'textarea' : 'input', attrs);
    if (isArea) input.value = attrs.value;
    input.addEventListener('input', function () {
      liveFilter(field, input, path);
      P.saveDraft();
    });
    input.addEventListener('blur', function () {
      leave(field, input, path);
    });
    return input;
  }

  P.textControl = textControl;
})(window.App);

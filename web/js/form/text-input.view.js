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

  /** Removes what a field type does not allow while the person types or pastes. */
  function liveFilter(field, input, path) {
    var before = input.value;
    var after = before;
    var message = '';
    if (field.type === 'arabic_name') {
      var c = Rules.cleanArabicName(before, false);
      after = c.value;
      if (c.blocked) message = t('hintArabic');
    } else if (field.type === 'english_text') {
      after = before.replace(/[\u0600-\u06FF\u0750-\u077F]/g, '');
      if (after !== before) message = t('hintEnglish');
    } else if (field.type === 'code') {
      var digits = Rules.latinDigits(before).replace(/\s+/g, '');
      after = digits.replace(/\D/g, '').slice(0, field.length || 7);
      if (digits.replace(/\D/g, '') !== digits) message = t('hintDigits');
    } else if (field.type === 'phone') {
      var d = Rules.latinDigits(before);
      after = d.replace(/[^\d+\s\-()]/g, '');
      if (after !== d) message = t('hintDigits');
    }
    if (after !== before) {
      var pos = input.selectionStart;
      input.value = after;
      try {
        var np = Math.max(
          0,
          (pos == null ? after.length : pos) - (before.length - after.length)
        );
        input.setSelectionRange(np, np);
      } catch (e) {
        /* not all inputs */
      }
    }
    if (message) P.hint(input, message);
    P.setVal(path, input.value);
    if (field.role === 'title') P.paintFolderRule();
    if (S.errors[path]) {
      delete S.errors[path];
      P.paintError(path);
    }
  }

  // A hint of the shape of an answer. It must not read as an answer that is already there.
  var PLACEHOLDERS = {
    email: 'name@example.com',
    phone: '01xxxxxxxxx',
    drive_link: 'https://drive.google.com/...'
  };

  function textControl(field, path, id) {
    var isArea = field.type === 'textarea';
    var attrs = {
      id: id,
      class: isArea ? 'textarea' : 'input',
      name: path,
      value: P.getVal(path) == null ? '' : String(P.getVal(path)),
      'aria-describedby': id + '-help ' + id + '-err',
      autocomplete: 'off',
      placeholder: PLACEHOLDERS[field.type] || null
    };
    if (!isArea) {
      attrs.type =
        { email: 'email', phone: 'tel', drive_link: 'url' }[field.type] ||
        'text';
      if (field.type === 'arabic_name') {
        attrs.lang = 'ar';
        attrs.dir = 'rtl';
        attrs.autocomplete = 'name';
      } else {
        attrs.dir = 'ltr';
      }
      if (field.type === 'code') attrs.inputmode = 'numeric';
      if (field.type === 'phone') {
        attrs.inputmode = 'tel';
        attrs.autocomplete = 'tel';
      }
      if (field.type === 'email') {
        attrs.inputmode = 'email';
        attrs.autocomplete = 'email';
        attrs.autocapitalize = 'off';
      }
      if (field.type === 'code') attrs.maxlength = String(field.length || 7);
    }
    var input = h(isArea ? 'textarea' : 'input', attrs);
    if (isArea) input.value = attrs.value;
    input.addEventListener('input', function () {
      liveFilter(field, input, path);
      P.saveDraft();
    });
    input.addEventListener('blur', function () {
      if (field.type === 'phone') {
        var p = Rules.normalizePhone(input.value);
        if (p) {
          input.value = p;
          P.setVal(path, p);
        }
      }
      if (
        input.value.trim() !== '' ||
        S.errors[path] ||
        field.required !== false
      ) {
        if (input.value.trim() !== '' || S.errors[path])
          P.validateOne(field, path);
      }
    });
    return input;
  }

  P.textControl = textControl;
})(window.App);

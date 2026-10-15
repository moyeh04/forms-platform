/**
 * Answers picked from a list: chips for a few choices and a dropdown for many.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var L = P.L;
  var S = P.S;

  function selectControl(field, path, id) {
    var opts = field.options || [];
    var cur = P.getVal(path) || '';
    // Only one possible answer (a form limited to one specialization): fill it in.
    if (
      opts.length === 1 &&
      field.required !== false &&
      String(cur) !== String(opts[0].value)
    ) {
      cur = opts[0].value;
      P.setVal(path, cur);
    }
    var onPick = function (v) {
      P.setVal(path, v);
      if (S.errors[path]) {
        delete S.errors[path];
        P.paintError(path);
      }
      P.saveDraft();
    };
    if (opts.length <= 4 && opts.length > 0) {
      return h(
        'div',
        {
          class: 'chips',
          role: 'radiogroup',
          id: id,
          'aria-describedby': id + '-err'
        },
        opts.map(function (o) {
          return h(
            'label',
            { class: 'chip' },
            h('input', {
              type: 'radio',
              name: path,
              value: o.value,
              checked: String(cur) === String(o.value),
              onchange: function () {
                onPick(o.value);
              }
            }),
            h('span', null, L(o.label))
          );
        })
      );
    }
    var sel = h(
      'select',
      {
        id: id,
        class: 'select',
        name: path,
        'aria-describedby': id + '-help ' + id + '-err',
        onchange: function (e) {
          onPick(e.target.value);
        }
      },
      h('option', { value: '' }, t('choose')),
      opts.map(function (o) {
        return h(
          'option',
          { value: o.value, selected: String(cur) === String(o.value) },
          L(o.label)
        );
      })
    );
    return sel;
  }

  P.selectControl = selectControl;
})(window.App);

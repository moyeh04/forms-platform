/**
 * The top of the page: the bar with the language and theme switches, and the
 * head of the form with its title, term, subject and audience.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = P.t;
  var L = P.L;
  var S = P.S;

  function topbar() {
    var bar = h('div', { class: 'topbar' });
    var allow = !S.form || !S.form.lang || S.form.lang.allowSwitch !== false;
    if (allow) {
      bar.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'icon-btn',
            lang: App.i18n.lang === 'ar' ? 'en' : 'ar',
            onclick: function () {
              App.i18n.set(App.i18n.lang === 'ar' ? 'en' : 'ar', true);
              P.render();
            }
          },
          t('langToggle')
        )
      );
    }
    bar.appendChild(App.ui.themeButton(t('themeToggle')));
    return bar;
  }

  /** "Computers students only", from the form's allowed specializations. */
  function audience() {
    var allowed = S.form && S.form.rules && S.form.rules.majors;
    if (!allowed || !allowed.length) return null;
    var mf = (S.form.fields || []).filter(function (f) {
      return f.list === 'majors';
    })[0];
    var names = allowed.map(function (v) {
      var o =
        mf &&
        (mf.options || []).filter(function (x) {
          return String(x.value) === String(v);
        })[0];
      return o ? L(o.label) : v;
    });
    return h(
      'p',
      { class: 'audience' },
      icon('team', 18),
      h('span', null, t('onlyFor', { names: names.join(t('and')) }))
    );
  }

  function head() {
    var ic =
      S.form && S.form.icon !== 'none' ? App.ui.formIcon(S.form.icon) : null;
    return h(
      'header',
      { class: 'form-head' },
      ic ? h('span', { class: 'form-icon' }, icon(ic, 30)) : null,
      h('h1', { class: 'form-title' }, S.form ? S.form.title : ''),
      S.form && FormMetadata.display(S.form).length
        ? h(
            'div',
            { class: 'tags' },
            FormMetadata.display(S.form).map(function (item) {
              return h(
                'span',
                {
                  class:
                    'tag' + (item.variant === 'subject' ? ' tag-subject' : ''),
                  lang: item.variant === 'subject' ? 'en' : null,
                  dir: item.variant === 'subject' ? 'ltr' : null
                },
                item.value
              );
            })
          )
        : null,
      audience()
    );
  }

  P.topbar = topbar;
  P.head = head;
})(window.App);

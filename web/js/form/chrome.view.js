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

  /** The size of the icon before the audience line, in pixels. */
  var AUDIENCE_ICON_SIZE = 18;

  /** The size of the form's own icon in its head, in pixels. */
  var FORM_ICON_SIZE = 30;

  /**
   * Gives the language the switch leads to.
   *
   * @return {string} 'en' on an Arabic page, 'ar' otherwise.
   */
  function otherLang() {
    return App.i18n.lang === 'ar' ? 'en' : 'ar';
  }

  /**
   * Makes the bar at the top: the language switch, unless the form locks
   * the language, and the theme switch.
   *
   * @return {!Element} The bar.
   */
  function topbar() {
    var bar = h('div', { class: 'topbar' });
    var lang = S.form?.lang || {};
    if (lang.allowSwitch !== false) {
      bar.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'icon-btn',
            lang: otherLang(),
            onclick: function () {
              App.i18n.set(otherLang(), true);
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

  /**
   * Gives the name of a specialization, as the majors question shows it.
   *
   * @param {?Object} mf The majors question, or null.
   * @param {*} v The value of the specialization.
   * @return {string} Its label, or the value itself.
   */
  function majorName(mf, v) {
    var options = mf?.options || [];
    var o = options.filter(function (x) {
      return String(x.value) === String(v);
    })[0];
    return o ? L(o.label) : v;
  }

  /**
   * Draws who the form is for, such as "Computers students only", from its
   * allowed specializations.
   *
   * @return {?Element} The line, or null when every student may answer.
   */
  function audience() {
    var allowed = S.form?.rules?.majors;
    if (!allowed?.length) return null;
    var mf = (S.form.fields || []).filter(function (f) {
      return f.list === 'majors';
    })[0];
    var names = allowed.map(function (v) {
      return majorName(mf, v);
    });
    return h(
      'p',
      { class: 'audience' },
      icon('team', AUDIENCE_ICON_SIZE),
      h('span', null, t('onlyFor', { names: names.join(t('and')) }))
    );
  }

  /**
   * Draws the tags of the form: its term, batch and subject.
   *
   * @return {?Element} The tags, or null when it has none.
   */
  function tags() {
    var items = S.form ? FormMetadata.display(S.form) : [];
    if (!items.length) return null;
    return h(
      'div',
      { class: 'tags' },
      items.map(function (item) {
        var subject = item.variant === 'subject';
        return h(
          'span',
          {
            class: 'tag' + (subject ? ' tag-subject' : ''),
            lang: subject ? 'en' : null,
            dir: subject ? 'ltr' : null
          },
          item.value
        );
      })
    );
  }

  /**
   * Draws the head of the form: its icon, title, tags and audience.
   *
   * @return {!Element} The head.
   */
  function head() {
    var ic =
      S.form && S.form.icon !== 'none' ? App.ui.formIcon(S.form.icon) : null;
    return h(
      'header',
      { class: 'form-head' },
      ic ? h('span', { class: 'form-icon' }, icon(ic, FORM_ICON_SIZE)) : null,
      h('h1', { class: 'form-title' }, S.form ? S.form.title : ''),
      tags(),
      audience()
    );
  }

  P.topbar = topbar;
  P.head = head;
})(window.App);

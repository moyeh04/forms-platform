/**
 * The light and dark switch every page has. It changes its own icon, so
 * nothing typed on the page is lost.
 */
(function (App) {
  'use strict';

  var ui = App.ui;

  /** The width and height of the switch's icon, in pixels. */
  var THEME_ICON_SIZE = 20;

  /**
   * Makes the icon of the theme the switch leads to.
   *
   * @return {!Element} A sun on a dark page, a moon on a light one.
   */
  function themeFace() {
    var dark = App.theme.effective() === 'dark';
    return ui.icon(dark ? 'sun' : 'moon', THEME_ICON_SIZE);
  }

  /**
   * Makes the switch.
   *
   * @param {string=} label Its name for screen readers.
   * @return {!Element} The button.
   */
  function themeButton(label) {
    var btn = ui.h(
      'button',
      {
        type: 'button',
        class: 'icon-btn',
        name: 'theme',
        'aria-label': label || 'Switch light and dark',
        onclick: function () {
          App.theme.toggle();
          ui.clear(btn).appendChild(themeFace());
        }
      },
      themeFace()
    );
    return btn;
  }

  App.ui.themeButton = themeButton;
})(window.App);

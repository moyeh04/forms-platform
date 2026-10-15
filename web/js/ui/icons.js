/** The inline icons the pages draw, as SVG paths in one table. */
(function (App) {
  'use strict';

  /** The width and height of an icon, in pixels, when none is given. */
  var ICON_SIZE = 22;

  /** The stroke width of every icon. */
  var ICON_STROKE = 1.7;

  /** The icons a form can show next to its title. */
  var FORM_ICONS = ['team', 'calendar', 'task', 'chat'];

  /** The inside of each icon's SVG, drawn on a 24 by 24 grid. */
  var ICONS = {
    team:
      '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/>' +
      '<path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/>' +
      '<path d="M15.5 14.3c2.7-.4 5 1.3 5 4.2"/>',
    calendar:
      '<rect x="3.5" y="5" width="17" height="15" rx="2"/>' +
      '<path d="M3.5 10h17M8 3v4M16 3v4"/>' +
      '<path d="M8 14h2M12 14h2M8 17h2"/>',
    task:
      '<path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5' +
      'a1 1 0 0 1 1-1z"/><path d="M14 3.5V8h4"/>' +
      '<path d="M8.5 13.5l2 2 4-4.5"/>',
    chat:
      '<path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-8l-4.5 3.5V17H4' +
      'a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13h5"/>',
    sun:
      '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2' +
      'M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash:
      '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8' +
      'a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    copy:
      '<rect x="8" y="8" width="12" height="12" rx="2"/>' +
      '<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8' +
      'a2 2 0 0 0 2 2h2"/>',
    download: '<path d="M12 4v11M7.5 11L12 15.5 16.5 11M5 19h14"/>',
    printer:
      '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12' +
      'a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/>' +
      '<rect x="7" y="14" width="10" height="6"/>',
    link:
      '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/>' +
      '<path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    arrow: '<path d="M4 12h15M14 6l6 6-6 6"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
    eye:
      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5' +
      ' 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    star:
      '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7' +
      'l1-5.9L3.5 9.7l5.9-.8z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
    warn: '<path d="M12 4.2l8.6 15H3.4z"/><path d="M12 10.2v4.3M12 16.9v.1"/>',
    logout:
      '<path d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4' +
      'M19 12H9"/>'
  };

  /**
   * Makes an icon, hidden from screen readers.
   *
   * @param {string} name The icon, a key of the table; an unknown name
   *     gives an empty icon.
   * @param {number=} size Its width and height in pixels.
   * @return {!Element} A span holding the SVG.
   */
  function icon(name, size) {
    var s = document.createElement('span');
    s.className = 'icon icon-' + name;
    s.setAttribute('aria-hidden', 'true');
    var px = size || ICON_SIZE;
    s.innerHTML =
      '<svg viewBox="0 0 24 24" width="' +
      px +
      '" height="' +
      px +
      '" fill="none" stroke="currentColor" stroke-width="' +
      ICON_STROKE +
      '" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[name] || '') +
      '</svg>';
    return s;
  }

  /**
   * Checks the icon a form asks for.
   *
   * @param {*} name The icon the form names.
   * @return {?string} The name when a form may use it, or null.
   */
  function formIcon(name) {
    return FORM_ICONS.indexOf(name) !== -1 ? name : null;
  }

  App.ui.icon = icon;
  App.ui.formIcon = formIcon;
})(window.App);

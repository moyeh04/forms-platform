/**
 * The route as a sea: an island for each step, the treasure island at the end
 * and the ship at the current step. Also the sheet the page is drawn on and the
 * banner above it.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = P.t;
  var S = P.S;

  /** The size of the X on the treasure island, in pixels. */
  var X_SIZE = 26;

  /** The middle of a stop, as a part of its width. */
  var MIDDLE = 0.5;

  /** The decimals of a position along the route. */
  var DECIMALS = 3;

  /** The width of the route, in percent. */
  var FULL = 100;

  /**
   * The step the ship was last drawn at, so that it sails on from there to
   * the next island.
   */
  var shipAt = null;

  /**
   * Makes a picture of the route.
   *
   * @param {string} name The file name in assets/img, without `.svg`.
   * @param {string=} cls Its class.
   * @return {!Element} The image.
   */
  function art(name, cls) {
    return h('img', {
      class: cls,
      src: 'assets/img/' + name + '.svg',
      alt: '',
      draggable: 'false'
    });
  }

  /**
   * Gives the place of a stop along the route.
   *
   * @param {number} i The stop.
   * @param {number} stops How many stops there are.
   * @return {string} The place, as a CSS percentage.
   */
  function stopAt(i, stops) {
    return (((i + MIDDLE) * FULL) / stops).toFixed(DECIMALS) + '%';
  }

  /**
   * Makes the island of a step.
   *
   * @param {!Object} s The step.
   * @param {number} i Its index.
   * @return {!Element} The island.
   */
  function island(s, i) {
    var state = '';
    if (i < S.stepIndex) state = 'is-done';
    else if (i === S.stepIndex) state = 'is-current';
    return h(
      'li',
      { class: state, 'aria-current': i === S.stepIndex ? 'step' : null },
      h('span', { class: 'isle' }, art('island')),
      h('span', { class: 'trail-label' }, P.stepTitle(s))
    );
  }

  /**
   * Makes the treasure island, with the X at the end of the route.
   *
   * @return {!Element} The island.
   */
  function treasureIsland() {
    return h(
      'li',
      { class: 'trail-x', 'aria-hidden': 'true' },
      h(
        'span',
        { class: 'isle' },
        art('island'),
        art('treasure', 'trail-treasure'),
        icon('x', X_SIZE)
      ),
      h('span', { class: 'trail-label' }, t('treasure'))
    );
  }

  /**
   * Draws the route as a sea: an island for each step, then the treasure
   * island, and the ship at the island of the current step.
   *
   * @return {!Array<!Element>} The sea and the line under it.
   */
  function trail() {
    var stops = S.steps.length + 1;
    var from = shipAt === null ? S.stepIndex : shipAt;
    shipAt = S.stepIndex;
    var items = S.steps.map(island);
    items.push(treasureIsland());
    var place =
      '--at:' + stopAt(S.stepIndex, stops) + ';--from:' + stopAt(from, stops);
    return [
      h(
        'div',
        { class: 'trail-sea' },
        h('ol', { class: 'trail' }, items),
        h('span', { class: 'trail-ship', style: place }, art('ship'))
      ),
      h(
        'p',
        { class: 'step-count' },
        t('stepOf', { n: S.stepIndex + 1, total: S.steps.length }) +
          ' - ' +
          P.stepTitle(S.steps[S.stepIndex])
      )
    ];
  }

  /**
   * Makes the sheet a page is drawn on.
   *
   * @param {...*} children What goes on it.
   * @return {!Element} The sheet.
   */
  function sheet(...children) {
    return h(
      'section',
      { class: 'sheet' },
      h('div', { class: 'wrap' }, children)
    );
  }

  /**
   * Draws the banner above the page.
   *
   * @return {?Element} The banner, or null when there is none.
   */
  function bannerEl() {
    if (!S.banner) return null;
    var info = S.banner.kind === 'info';
    return h(
      'div',
      {
        class: 'banner' + (info ? ' info' : ''),
        role: info ? 'status' : 'alert'
      },
      S.banner.text,
      ' ',
      S.banner.action || null
    );
  }

  P.sheet = sheet;
  P.trail = trail;
  P.bannerEl = bannerEl;
})(window.App);

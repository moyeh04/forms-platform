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

  // The step the ship was last drawn at, so that it sails on from there to the next island.
  var shipAt = null;

  function art(name, cls) {
    return h('img', {
      class: cls,
      src: 'assets/img/' + name + '.svg',
      alt: '',
      draggable: 'false'
    });
  }

  /** The route as a sea: an island for each step, then the treasure island, and the ship at the island of the current step. */
  function trail() {
    var stops = S.steps.length + 1;
    var at = function (i) {
      return (((i + 0.5) * 100) / stops).toFixed(3) + '%';
    };
    var from = shipAt === null ? S.stepIndex : shipAt;
    shipAt = S.stepIndex;
    var items = S.steps.map(function (s, i) {
      return h(
        'li',
        {
          class:
            i < S.stepIndex ? 'is-done' : i === S.stepIndex ? 'is-current' : '',
          'aria-current': i === S.stepIndex ? 'step' : null
        },
        h('span', { class: 'isle' }, art('island')),
        h('span', { class: 'trail-label' }, P.stepTitle(s))
      );
    });
    // The treasure waits at the X on the last island, at the end of the route.
    items.push(
      h(
        'li',
        { class: 'trail-x', 'aria-hidden': 'true' },
        h(
          'span',
          { class: 'isle' },
          art('island'),
          art('treasure', 'trail-treasure'),
          icon('x', 26)
        ),
        h('span', { class: 'trail-label' }, t('treasure'))
      )
    );
    return [
      h(
        'div',
        { class: 'trail-sea' },
        h('ol', { class: 'trail' }, items),
        h(
          'span',
          {
            class: 'trail-ship',
            style: '--at:' + at(S.stepIndex) + ';--from:' + at(from)
          },
          art('ship')
        )
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

  function sheet() {
    return h(
      'section',
      { class: 'sheet' },
      h('div', { class: 'wrap' }, Array.prototype.slice.call(arguments))
    );
  }

  function bannerEl() {
    if (!S.banner) return null;
    return h(
      'div',
      {
        class: 'banner' + (S.banner.kind === 'info' ? ' info' : ''),
        role: S.banner.kind === 'info' ? 'status' : 'alert'
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

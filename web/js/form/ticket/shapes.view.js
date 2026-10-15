/** The colours and small shapes of the ticket picture. */
(function (App) {
  'use strict';

  var T = App.ticket;

  /*
   * The picture, the same in both languages: the parrot pointing at a ship's clock, then the
   * pirate pointing his hook at a calendar, on a card of parchment. The pirate and the parrot are drawings (assets/img); the calendar and
   * the clock are drawn here, since they change with the booking. Everything has its own colours,
   * so the picture looks the same in both themes and in the saved image. The viewBox is 440 by 220.
   */
  var C = {
    line: '#2A1C12',
    paper: '#FBF4E2',
    page: '#F3E9D2',
    red: '#A3312A',
    redDark: '#7A221C',
    gold: '#E2B23C',
    goldDark: '#A9822C',
    goldLight: '#F6D77A',
    wood: '#7A4E2D',
    woodDark: '#5A3720',
    woodLight: '#93643C',
    face: '#F8F0DC',
    hand: '#3B2414',
    arrow: '#9C2B22'
  };

  function el(tag, attrs) {
    return (
      '<' +
      tag +
      Object.keys(attrs)
        .map(function (k) {
          return ' ' + k + '="' + attrs[k] + '"';
        })
        .join('') +
      '/>'
    );
  }

  function path(d, fill, extra) {
    return el(
      'path',
      Object.assign({ d: d, fill: fill || 'none' }, extra || {})
    );
  }

  function polar(cx, cy, r, deg) {
    var a = (deg * Math.PI) / 180;
    return [
      (cx + r * Math.sin(a)).toFixed(1),
      (cy - r * Math.cos(a)).toFixed(1)
    ];
  }

  function shadow(cx, cy, rx) {
    return el('ellipse', {
      cx: cx,
      cy: cy,
      rx: rx,
      ry: 6,
      fill: C.line,
      opacity: '.13'
    });
  }

  /** A brass knob: a gold ball with a dark side, a shine, and on the top one a screw. */
  function knob(x, y, r, screw) {
    return (
      el('circle', {
        cx: x,
        cy: y,
        r: r,
        fill: C.gold,
        stroke: C.line,
        'stroke-width': 2
      }) +
      path(
        'M' +
          (x - r * 0.7) +
          ' ' +
          (y + r * 0.45) +
          'a' +
          r * 0.85 +
          ' ' +
          r * 0.85 +
          ' 0 0 0 ' +
          r * 1.45 +
          ' -0.3',
        'none',
        {
          stroke: C.goldDark,
          'stroke-width': r * 0.3,
          'stroke-linecap': 'round',
          opacity: '.8'
        }
      ) +
      el('circle', {
        cx: (x - r * 0.35).toFixed(1),
        cy: (y - r * 0.35).toFixed(1),
        r: (r * 0.32).toFixed(1),
        fill: C.goldLight
      }) +
      (screw ? el('circle', { cx: x, cy: y, r: 1.3, fill: C.goldDark }) : '')
    );
  }

  T.C = C;
  T.el = el;
  T.path = path;
  T.shadow = shadow;
  T.polar = polar;
  T.knob = knob;
})(window.App);

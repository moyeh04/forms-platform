/** The desk calendar of the ticket picture. */
(function (App) {
  'use strict';

  var T = App.ticket;

  /**
   * A desk calendar: a red band with rounded top, a light line and a dark strip, two gold rings
   * through it, pages stacked behind at the right, and the bottom left corner curled up. It is
   * drawn at the left edge and moved to its place at the right of the picture, raised so the
   * pirate's hook points at the day.
   */
  function calendarArt() {
    var o = {
      stroke: T.C.line,
      'stroke-width': 2.4,
      'stroke-linejoin': 'round'
    };
    var ring = function (x) {
      return (
        T.el('ellipse', {
          cx: x,
          cy: 46,
          rx: 6.4,
          ry: 9.6,
          fill: T.C.gold,
          stroke: T.C.line,
          'stroke-width': 2.2
        }) +
        T.el('ellipse', {
          cx: x + 0.6,
          cy: 46.5,
          rx: 2.4,
          ry: 5.6,
          fill: '#5E1D18',
          stroke: T.C.line,
          'stroke-width': 1.4
        }) +
        T.path('M' + (x - 4.2) + ' 41c-.8 3-.8 8 0 11', 'none', {
          stroke: T.C.goldLight,
          'stroke-width': 1.6,
          'stroke-linecap': 'round'
        })
      );
    };
    return (
      '<g transform="translate(292 -26)">' +
      T.shadow(74, 172, 64) +
      // The pages behind, seen only at the right edge.
      T.path('M14 74h116v84a6 6 0 0 1-6 6H14z', T.C.page, o) +
      T.path('M14 74h113v86a6 6 0 0 1-6 6H14z', T.C.page, o) +
      // The front page, cut at the corner that curls.
      T.path('M14 74h110v88a6 6 0 0 1-6 6H37l-23-22z', T.C.paper, o) +
      // The curl: the back of the corner, lifted and rolled toward the page.
      T.path(
        'M14 146c5 2 9 5 11 9c2 4 3 9 12 13c-6 1-12-1-16-5c-4-4-6-10-7-17z',
        '#EADFC6',
        o
      ) +
      T.path('M18 151c2 3 4 7 6 10', 'none', {
        stroke: '#CDBF9F',
        'stroke-width': 1.2,
        'stroke-linecap': 'round'
      }) +
      // The band over the whole width, with its light line and dark strip.
      T.path(
        'M14 56a10 10 0 0 1 10-10h96a10 10 0 0 1 10 10v22H14z',
        T.C.red,
        o
      ) +
      T.path('M15.3 72.5h113.4v4.3H15.3z', T.C.redDark) +
      T.path('M22 50.5h92', 'none', {
        stroke: '#C24A40',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        opacity: '.75'
      }) +
      ring(41) +
      ring(100) +
      '</g>'
    );
  }

  T.calendarArt = calendarArt;
})(window.App);

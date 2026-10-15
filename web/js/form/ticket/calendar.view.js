/**
 * The desk calendar of the ticket picture: a red band with rounded top, a
 * light line and a dark strip, two gold rings through it, pages stacked
 * behind at the right, and the bottom left corner curled up. It is drawn at
 * the left edge and moved to its place at the right of the picture, raised
 * so the pirate's hook points at the day.
 */
(function (App) {
  'use strict';

  var T = App.ticket;
  var C = T.COLORS;

  /** Where the calendar stands and the outlines it is drawn with. */
  var CALENDAR = {
    MOVE: 'translate(292 -26)',
    SHADOW: { X: 74, Y: 172, HALF_WIDTH: 64 },
    LINE: 2.4,
    CURL_LINE: 1.2,
    BAND_LINE: 2,
    BAND_LINE_OPACITY: '.75',
    PAGE_BACK: 'M14 74h116v84a6 6 0 0 1-6 6H14z',
    PAGE_MIDDLE: 'M14 74h113v86a6 6 0 0 1-6 6H14z',
    PAGE_FRONT: 'M14 74h110v88a6 6 0 0 1-6 6H37l-23-22z',
    CURL: 'M14 146c5 2 9 5 11 9c2 4 3 9 12 13c-6 1-12-1-16-5c-4-4-6-10-7-17z',
    CURL_FOLD: 'M18 151c2 3 4 7 6 10',
    BAND: 'M14 56a10 10 0 0 1 10-10h96a10 10 0 0 1 10 10v22H14z',
    BAND_STRIP: 'M15.3 72.5h113.4v4.3H15.3z',
    BAND_SHINE: 'M22 50.5h92'
  };

  /** A gold ring through the band: its place, its hole and its shine. */
  var RING = {
    LEFT: 41,
    RIGHT: 100,
    Y: 46,
    HALF_WIDTH: 6.4,
    HALF_HEIGHT: 9.6,
    LINE: 2.2,
    HOLE_SHIFT: 0.6,
    HOLE_Y: 46.5,
    HOLE_HALF_WIDTH: 2.4,
    HOLE_HALF_HEIGHT: 5.6,
    HOLE_LINE: 1.4,
    SHINE_SHIFT: 4.2,
    SHINE: ' 41c-.8 3-.8 8 0 11',
    SHINE_LINE: 1.6
  };

  /**
   * Draws a gold ring through the band.
   *
   * @param {number} x Its middle, across.
   * @return {string} The markup.
   */
  function ring(x) {
    var outer = T.el('ellipse', {
      cx: x,
      cy: RING.Y,
      rx: RING.HALF_WIDTH,
      ry: RING.HALF_HEIGHT,
      fill: C.gold,
      stroke: C.line,
      'stroke-width': RING.LINE
    });
    var hole = T.el('ellipse', {
      cx: x + RING.HOLE_SHIFT,
      cy: RING.HOLE_Y,
      rx: RING.HOLE_HALF_WIDTH,
      ry: RING.HOLE_HALF_HEIGHT,
      fill: C.ringHole,
      stroke: C.line,
      'stroke-width': RING.HOLE_LINE
    });
    var shine = T.path('M' + (x - RING.SHINE_SHIFT) + RING.SHINE, 'none', {
      stroke: C.goldLight,
      'stroke-width': RING.SHINE_LINE,
      'stroke-linecap': 'round'
    });
    return outer + hole + shine;
  }

  /**
   * Draws the pages: the two behind, seen only at the right edge, the
   * front one cut at the corner that curls, and the curl itself, the back
   * of the corner lifted and rolled toward the page.
   *
   * @param {!Object} o The outline of a page.
   * @return {string} The markup.
   */
  function pages(o) {
    return (
      T.path(CALENDAR.PAGE_BACK, C.page, o) +
      T.path(CALENDAR.PAGE_MIDDLE, C.page, o) +
      T.path(CALENDAR.PAGE_FRONT, C.paper, o) +
      T.path(CALENDAR.CURL, C.curl, o) +
      T.path(CALENDAR.CURL_FOLD, 'none', {
        stroke: C.curlLine,
        'stroke-width': CALENDAR.CURL_LINE,
        'stroke-linecap': 'round'
      })
    );
  }

  /**
   * Draws the band over the whole width, with its light line and dark
   * strip.
   *
   * @param {!Object} o The outline of the band.
   * @return {string} The markup.
   */
  function band(o) {
    return (
      T.path(CALENDAR.BAND, C.red, o) +
      T.path(CALENDAR.BAND_STRIP, C.redDark) +
      T.path(CALENDAR.BAND_SHINE, 'none', {
        stroke: C.redLight,
        'stroke-width': CALENDAR.BAND_LINE,
        'stroke-linecap': 'round',
        opacity: CALENDAR.BAND_LINE_OPACITY
      })
    );
  }

  /**
   * Draws the calendar.
   *
   * @return {string} The markup.
   */
  function calendarArt() {
    var o = {
      stroke: C.line,
      'stroke-width': CALENDAR.LINE,
      'stroke-linejoin': 'round'
    };
    var spot = CALENDAR.SHADOW;
    return (
      '<g transform="' +
      CALENDAR.MOVE +
      '">' +
      T.shadow(spot.X, spot.Y, spot.HALF_WIDTH) +
      pages(o) +
      band(o) +
      ring(RING.LEFT) +
      ring(RING.RIGHT) +
      '</g>'
    );
  }

  T.calendarArt = calendarArt;
})(window.App);

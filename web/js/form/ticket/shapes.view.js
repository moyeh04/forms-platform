/**
 * The colours of the ticket picture and the small SVG shapes it is drawn
 * with.
 *
 * The picture is the same in both languages: the parrot pointing at a
 * ship's clock, then the pirate pointing his hook at a calendar, on a card
 * of parchment. The pirate and the parrot are drawings (assets/img); the
 * calendar and the clock are drawn here, since they change with the
 * booking. Everything has its own colours, so the picture looks the same in
 * both themes and in the saved image. The viewBox is 440 by 220.
 */
(function (App) {
  'use strict';

  var T = App.ticket;

  /** The colours of the picture. */
  var COLORS = {
    line: '#2A1C12',
    paper: '#FBF4E2',
    page: '#F3E9D2',
    curl: '#EADFC6',
    curlLine: '#CDBF9F',
    red: '#A3312A',
    redDark: '#7A221C',
    redLight: '#C24A40',
    ringHole: '#5E1D18',
    gold: '#E2B23C',
    goldDark: '#A9822C',
    goldLight: '#F6D77A',
    wood: '#7A4E2D',
    woodDark: '#5A3720',
    woodLight: '#93643C',
    face: '#F8F0DC',
    faceRing: '#E6D9BC',
    hand: '#3B2414',
    handLine: '#1E130B',
    arrow: '#9C2B22',
    cardLine: '#CDBB94'
  };

  /** The soft shadow under a thing that stands on the card. */
  var SHADOW = { HEIGHT: 6, OPACITY: '.13' };

  /**
   * A brass knob, its parts as fractions of its radius: the dark side, the
   * shine, and the screw of the top one.
   */
  var KNOB = {
    LINE: 2,
    SIDE_X: 0.7,
    SIDE_Y: 0.45,
    SIDE_CURVE: 0.85,
    SIDE_WIDTH: 1.45,
    SIDE_LINE: 0.3,
    SIDE_OPACITY: '.8',
    SHINE_AT: 0.35,
    SHINE_SIZE: 0.32,
    SCREW: 1.3
  };

  /**
   * Writes an SVG element with no children.
   *
   * @param {string} tag The tag.
   * @param {!Object} attrs Its attributes.
   * @return {string} The markup.
   */
  function el(tag, attrs) {
    var list = Object.keys(attrs).map(function (k) {
      return ' ' + k + '="' + attrs[k] + '"';
    });
    return '<' + tag + list.join('') + '/>';
  }

  /**
   * Writes an SVG path.
   *
   * @param {string} d Its outline.
   * @param {string=} fill Its fill; none when absent.
   * @param {!Object=} extra Its other attributes.
   * @return {string} The markup.
   */
  function path(d, fill, extra) {
    return el(
      'path',
      Object.assign({ d: d, fill: fill || 'none' }, extra || {})
    );
  }

  /**
   * Finds a point at a distance and an angle from a centre.
   *
   * @param {number} cx The centre, across.
   * @param {number} cy The centre, down.
   * @param {number} r The distance.
   * @param {number} deg The angle, clockwise from 12.
   * @return {!Array<string>} The point, rounded to a tenth.
   */
  function polar(cx, cy, r, deg) {
    var a = (deg * Math.PI) / T.DIAL.HALF_TURN;
    return [
      (cx + r * Math.sin(a)).toFixed(1),
      (cy - r * Math.cos(a)).toFixed(1)
    ];
  }

  /**
   * Draws the shadow under a thing.
   *
   * @param {number} cx Its middle, across.
   * @param {number} cy Its middle, down.
   * @param {number} rx Half its width.
   * @return {string} The markup.
   */
  function shadow(cx, cy, rx) {
    return el('ellipse', {
      cx: cx,
      cy: cy,
      rx: rx,
      ry: SHADOW.HEIGHT,
      fill: COLORS.line,
      opacity: SHADOW.OPACITY
    });
  }

  /**
   * Writes the dark side of a knob: an arc under its middle.
   *
   * @param {number} x The middle, across.
   * @param {number} y The middle, down.
   * @param {number} r The radius.
   * @return {string} The outline.
   */
  function knobSide(x, y, r) {
    var curve = r * KNOB.SIDE_CURVE;
    return (
      'M' +
      (x - r * KNOB.SIDE_X) +
      ' ' +
      (y + r * KNOB.SIDE_Y) +
      'a' +
      curve +
      ' ' +
      curve +
      ' 0 0 0 ' +
      r * KNOB.SIDE_WIDTH +
      ' -0.3'
    );
  }

  /**
   * Draws a brass knob: a gold ball with a dark side, a shine, and on the
   * top one a screw.
   *
   * @param {number} x The middle, across.
   * @param {number} y The middle, down.
   * @param {number} r The radius.
   * @param {boolean=} screw True to draw the screw.
   * @return {string} The markup.
   */
  function knob(x, y, r, screw) {
    var ball = el('circle', {
      cx: x,
      cy: y,
      r: r,
      fill: COLORS.gold,
      stroke: COLORS.line,
      'stroke-width': KNOB.LINE
    });
    var side = path(knobSide(x, y, r), 'none', {
      stroke: COLORS.goldDark,
      'stroke-width': r * KNOB.SIDE_LINE,
      'stroke-linecap': 'round',
      opacity: KNOB.SIDE_OPACITY
    });
    var shine = el('circle', {
      cx: (x - r * KNOB.SHINE_AT).toFixed(1),
      cy: (y - r * KNOB.SHINE_AT).toFixed(1),
      r: (r * KNOB.SHINE_SIZE).toFixed(1),
      fill: COLORS.goldLight
    });
    var bolt = screw
      ? el('circle', { cx: x, cy: y, r: KNOB.SCREW, fill: COLORS.goldDark })
      : '';
    return ball + side + shine + bolt;
  }

  T.COLORS = COLORS;
  T.el = el;
  T.path = path;
  T.polar = polar;
  T.shadow = shadow;
  T.knob = knob;
})(window.App);

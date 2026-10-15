/**
 * The ship's clock of the ticket picture: a wooden ring with its grain and
 * four brass knobs, a gold rim, and a paper face with 12, 3, 6 and 9 and a
 * mark at every other hour. Its hands and the slot come from
 * clock-hands.view.js.
 */
(function (App) {
  'use strict';

  var T = App.ticket;
  var C = T.COLORS;
  var DIAL = T.DIAL;
  var CENTRE = T.CLOCK_CENTRE;

  /** The wooden ring: its size, its lower shade and its shine. */
  var WOOD = {
    RADIUS: 65,
    LINE: 2.6,
    SHADE_FROM: 63,
    SHADE_DROP: 8,
    SHADE: 'a63 63 0 0 0 126 0a52 52 0 0 1-126 0z',
    SHADE_OPACITY: '.45',
    SHINE_RADIUS: 59,
    SHINE_FROM: 290,
    SHINE_TO: 340,
    SHINE_LINE: 2.6,
    SHINE_OPACITY: '.85',
    GRAIN_LINE: 1.3,
    GRAIN_OPACITY: '.7',
    SHADOW_Y: 178,
    SHADOW_HALF_WIDTH: 62
  };

  /** The lines of grain on the wood: a radius and the angles it runs. */
  var GRAIN = [
    { R: 61, FROM: 200, TO: 250 },
    { R: 58, FROM: 280, TO: 340 },
    { R: 60, FROM: 20, TO: 70 },
    { R: 57, FROM: 110, TO: 160 },
    { R: 62, FROM: 150, TO: 185 },
    { R: 56, FROM: 220, TO: 245 }
  ];

  /** The rings of the gold rim and the paper face, outside in. */
  var RIM = {
    GOLD: 52.5,
    GOLD_LINE: 2.2,
    SHINE: 50,
    SHINE_LINE: 1.2,
    SHINE_OPACITY: '.9',
    FACE: 47,
    FACE_LINE: 1.8,
    INNER: 45.3,
    INNER_LINE: 2
  };

  /** The hour marks, between the numbers. */
  var MARK = { FROM: 35.5, TO: 41, LINE: 2.2, NUMBER_EVERY: 3 };

  /** The numbers on the face and where each stands. */
  var NUMERAL = { RADIUS: 37, DROP: 5 };
  var NUMERALS = [
    { HOUR: 12, AT: 0 },
    { HOUR: 3, AT: 90 },
    { HOUR: 6, AT: 180 },
    { HOUR: 9, AT: 270 }
  ];
  var NUMERAL_FONT =
    ' text-anchor="middle"' +
    ' font-family="Georgia, \'Times New Roman\', serif"' +
    ' font-weight="700" font-size="14"';

  /** The pin in the middle, and the brass knobs round the ring. */
  var PIN = { RADIUS: 4.8, LINE: 1.6, SHINE_AT: 1.4, SHINE: 1.5 };
  var KNOBS = { UPRIGHT: 63, SIDE: 64, BIG: 7.5, SMALL: 5 };

  /**
   * Finds a point at a distance and an angle from the middle of the clock.
   *
   * @param {number} r The distance.
   * @param {number} deg The angle, clockwise from 12.
   * @return {!Array<string>} The point.
   */
  function at(r, deg) {
    return T.polar(CENTRE.X, CENTRE.Y, r, deg);
  }

  /**
   * Writes an arc round the middle of the clock.
   *
   * @param {number} r Its radius.
   * @param {number} from The angle it starts at.
   * @param {number} to The angle it ends at.
   * @return {string} The outline.
   */
  function arcAround(r, from, to) {
    var a = at(r, from);
    var b = at(r, to);
    return (
      'M' +
      a[0] +
      ' ' +
      a[1] +
      'A' +
      r +
      ' ' +
      r +
      ' 0 0 1 ' +
      b[0] +
      ' ' +
      b[1]
    );
  }

  /**
   * Draws a ring round the middle of the clock.
   *
   * @param {number} r Its radius.
   * @param {!Object} paint Its fill and stroke.
   * @return {string} The markup.
   */
  function ringOf(r, paint) {
    return T.el(
      'circle',
      Object.assign({ cx: CENTRE.X, cy: CENTRE.Y, r: r }, paint)
    );
  }

  /**
   * Draws the grain of the wood.
   *
   * @return {string} The markup.
   */
  function grain() {
    return GRAIN.map(function (g) {
      return T.path(arcAround(g.R, g.FROM, g.TO), 'none', {
        stroke: C.woodDark,
        'stroke-width': WOOD.GRAIN_LINE,
        'stroke-linecap': 'round',
        opacity: WOOD.GRAIN_OPACITY
      });
    }).join('');
  }

  /**
   * Draws the wooden ring: the wood, its lower shade, its grain and its
   * shine.
   *
   * @return {string} The markup.
   */
  function wood() {
    var shade =
      'M' +
      (CENTRE.X - WOOD.SHADE_FROM) +
      ' ' +
      (CENTRE.Y + WOOD.SHADE_DROP) +
      WOOD.SHADE;
    var shine = arcAround(WOOD.SHINE_RADIUS, WOOD.SHINE_FROM, WOOD.SHINE_TO);
    return (
      ringOf(WOOD.RADIUS, {
        fill: C.wood,
        stroke: C.line,
        'stroke-width': WOOD.LINE
      }) +
      T.path(shade, C.woodDark, { opacity: WOOD.SHADE_OPACITY }) +
      grain() +
      T.path(shine, 'none', {
        stroke: C.woodLight,
        'stroke-width': WOOD.SHINE_LINE,
        'stroke-linecap': 'round',
        opacity: WOOD.SHINE_OPACITY
      })
    );
  }

  /**
   * Draws the gold rim and the paper face.
   *
   * @return {string} The markup.
   */
  function face() {
    return (
      ringOf(RIM.GOLD, {
        fill: C.gold,
        stroke: C.line,
        'stroke-width': RIM.GOLD_LINE
      }) +
      ringOf(RIM.SHINE, {
        fill: 'none',
        stroke: C.goldLight,
        'stroke-width': RIM.SHINE_LINE,
        opacity: RIM.SHINE_OPACITY
      }) +
      ringOf(RIM.FACE, {
        fill: C.face,
        stroke: C.line,
        'stroke-width': RIM.FACE_LINE
      }) +
      ringOf(RIM.INNER, {
        fill: 'none',
        stroke: C.faceRing,
        'stroke-width': RIM.INNER_LINE
      })
    );
  }

  /**
   * Draws a mark at each hour that has no number.
   *
   * @return {string} The markup.
   */
  function marks() {
    var out = '';
    var a;
    var b;
    for (let hr = 1; hr < DIAL.HOURS; hr++) {
      if (hr % MARK.NUMBER_EVERY === 0) continue;
      a = at(MARK.FROM, hr * DIAL.PER_HOUR);
      b = at(MARK.TO, hr * DIAL.PER_HOUR);
      out += T.el('line', {
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        stroke: C.line,
        'stroke-width': MARK.LINE,
        'stroke-linecap': 'round'
      });
    }
    return out;
  }

  /**
   * Draws 12, 3, 6 and 9.
   *
   * @return {string} The markup.
   */
  function numerals() {
    return NUMERALS.map(function (n) {
      var p = at(NUMERAL.RADIUS, n.AT);
      var y = (+p[1] + NUMERAL.DROP).toFixed(1);
      return (
        '<text x="' +
        p[0] +
        '" y="' +
        y +
        '"' +
        NUMERAL_FONT +
        ' fill="' +
        C.line +
        '">' +
        n.HOUR +
        '</text>'
      );
    }).join('');
  }

  /**
   * Draws the pin the hands turn on, and the four brass knobs.
   *
   * @return {string} The markup.
   */
  function pinAndKnobs() {
    var x = CENTRE.X;
    var y = CENTRE.Y;
    return (
      ringOf(PIN.RADIUS, {
        fill: C.gold,
        stroke: C.line,
        'stroke-width': PIN.LINE
      }) +
      T.el('circle', {
        cx: x - PIN.SHINE_AT,
        cy: y - PIN.SHINE_AT,
        r: PIN.SHINE,
        fill: C.goldLight
      }) +
      T.knob(x, y - KNOBS.UPRIGHT, KNOBS.BIG, true) +
      T.knob(x, y + KNOBS.UPRIGHT, KNOBS.BIG) +
      T.knob(x - KNOBS.SIDE, y, KNOBS.SMALL) +
      T.knob(x + KNOBS.SIDE, y, KNOBS.SMALL)
    );
  }

  /**
   * Draws the clock.
   *
   * @param {?Array<number>} hands The hour and the minute angle.
   * @param {?Array<number>} arc The angles the slot starts and ends at.
   * @return {string} The markup.
   */
  function clockArt(hands, arc) {
    return (
      T.shadow(CENTRE.X, WOOD.SHADOW_Y, WOOD.SHADOW_HALF_WIDTH) +
      '<g>' +
      wood() +
      face() +
      T.sliceArt(arc) +
      marks() +
      numerals() +
      T.arrowArt(arc) +
      T.handsArt(hands) +
      pinAndKnobs() +
      '</g>'
    );
  }

  T.clockArt = clockArt;
})(window.App);

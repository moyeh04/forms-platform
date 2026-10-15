/**
 * The hands of the ticket's clock and the slot on its dial: spear-tipped
 * hands at the start of the slot, and the slot itself as a shaded slice of
 * the dial with a red arrow from the tip of the minute hand round to its
 * end.
 */
(function (App) {
  'use strict';

  var T = App.ticket;
  var C = T.COLORS;
  var DIAL = T.DIAL;

  /** The middle of the clock in the picture. */
  var CENTRE = { X: 118, Y: 104 };

  /** The shape of a hand, from its tail under the middle to its tip. */
  var HAND = {
    TAIL: 7,
    NECK: 0.55,
    BARB: 2.4,
    BARB_BACK: 6,
    LINE: 1.1
  };

  /** The length and half width of each hand. */
  var HOUR_HAND = { LENGTH: 23, HALF_WIDTH: 2.6 };
  var MINUTE_HAND = { LENGTH: 31, HALF_WIDTH: 2 };

  /** The shaded slice of the slot and the arrow along it. */
  var SLOT = {
    RADIUS: 45,
    OPACITY: '.16',
    HEAD: 7,
    WING: 4.6,
    LINE: 2.4,
    HEAD_LINE: 1.2
  };

  /**
   * Writes the outline of a hand pointing up from the middle.
   *
   * @param {number} len Its length.
   * @param {number} w Half its width.
   * @return {string} The outline.
   */
  function handOutline(len, w) {
    var cx = CENTRE.X;
    var cy = CENTRE.Y;
    var points = [
      [cx - w, cy + HAND.TAIL],
      [cx + w, cy + HAND.TAIL],
      [cx + w * HAND.NECK, cy - len + HAND.TAIL],
      [cx + w + HAND.BARB, cy - len + HAND.BARB_BACK],
      [cx, cy - len - 1],
      [cx - w - HAND.BARB, cy - len + HAND.BARB_BACK],
      [cx - w * HAND.NECK, cy - len + HAND.TAIL]
    ];
    var list = points.map(function (p) {
      return p[0] + ' ' + p[1];
    });
    return 'M' + list.join('L') + 'z';
  }

  /**
   * Draws a hand turned to its angle. It sweeps there from 12 when the
   * ticket appears.
   *
   * @param {number} deg The angle, clockwise from 12.
   * @param {!Object} size The hand, as `{LENGTH, HALF_WIDTH}`.
   * @return {string} The markup.
   */
  function hand(deg, size) {
    var turn = 'rotate(' + deg + ' ' + CENTRE.X + ' ' + CENTRE.Y + ')';
    return (
      '<g class="sweep" style="--from: ' +
      -deg +
      'deg">' +
      T.path(handOutline(size.LENGTH, size.HALF_WIDTH), C.hand, {
        stroke: C.handLine,
        'stroke-width': HAND.LINE,
        'stroke-linejoin': 'round',
        transform: turn
      }) +
      '</g>'
    );
  }

  /**
   * Draws both hands.
   *
   * @param {?Array<number>} hands The hour and the minute angle.
   * @return {string} The markup, or '' when there is no time.
   */
  function handsArt(hands) {
    if (!hands) return '';
    return hand(hands[0], HOUR_HAND) + hand(hands[1], MINUTE_HAND);
  }

  /**
   * Gives the flag of an SVG arc that says it is the long way round.
   *
   * @param {number} from The angle it starts at.
   * @param {number} to The angle it ends at.
   * @return {number} 1 for over half a turn, else 0.
   */
  function largeArc(from, to) {
    return to - from > DIAL.HALF_TURN ? 1 : 0;
  }

  /**
   * Draws the slot as a shaded slice of the dial.
   *
   * @param {?Array<number>} arc The angles the slot starts and ends at.
   * @return {string} The markup, or '' when there is no slot.
   */
  function sliceArt(arc) {
    if (!arc) return '';
    var r = SLOT.RADIUS;
    var s0 = T.polar(CENTRE.X, CENTRE.Y, r, arc[0]);
    var s1 = T.polar(CENTRE.X, CENTRE.Y, r, arc[1]);
    var d =
      'M' +
      CENTRE.X +
      ' ' +
      CENTRE.Y +
      'L' +
      s0[0] +
      ' ' +
      s0[1] +
      'A' +
      r +
      ' ' +
      r +
      ' 0 ' +
      largeArc(arc[0], arc[1]) +
      ' 1 ' +
      s1[0] +
      ' ' +
      s1[1] +
      'z';
    return T.path(d, C.arrow, { 'fill-opacity': SLOT.OPACITY, class: 'slice' });
  }

  /**
   * Writes the head of the arrow: a triangle from its tip back to two
   * wings across the line.
   *
   * @param {!Array<string>} tip The tip.
   * @param {!Array<string>} base Where the line meets the head.
   * @param {number} stop The angle of that point.
   * @return {string} The outline.
   */
  function arrowHead(tip, base, stop) {
    var a = (stop * Math.PI) / DIAL.HALF_TURN;
    var nx = Math.sin(a);
    var ny = -Math.cos(a);

    /**
     * Writes one wing of the head.
     *
     * @param {number} k 1 for one side, -1 for the other.
     * @return {string} The point.
     */
    function wing(k) {
      return (
        (+base[0] + nx * SLOT.WING * k).toFixed(1) +
        ' ' +
        (+base[1] + ny * SLOT.WING * k).toFixed(1)
      );
    }

    return 'M' + tip[0] + ' ' + tip[1] + 'L' + wing(1) + 'L' + wing(-1) + 'z';
  }

  /**
   * Draws the red arrow from the tip of the minute hand round to the end
   * of the slot.
   *
   * @param {?Array<number>} arc The angles the slot starts and ends at.
   * @return {string} The markup, or '' when there is no slot.
   */
  function arrowArt(arc) {
    if (!arc) return '';
    var r = MINUTE_HAND.LENGTH;
    var stop = arc[1] - ((SLOT.HEAD / r) * DIAL.HALF_TURN) / Math.PI;
    var p0 = T.polar(CENTRE.X, CENTRE.Y, r, arc[0]);
    var p1 = T.polar(CENTRE.X, CENTRE.Y, r, stop);
    var tip = T.polar(CENTRE.X, CENTRE.Y, r, arc[1]);
    var line =
      'M' +
      p0[0] +
      ' ' +
      p0[1] +
      'A' +
      r +
      ' ' +
      r +
      ' 0 ' +
      largeArc(arc[0], stop) +
      ' 1 ' +
      p1[0] +
      ' ' +
      p1[1];
    return (
      '<g class="slice">' +
      T.path(line, 'none', {
        stroke: C.arrow,
        'stroke-width': SLOT.LINE,
        'stroke-linecap': 'round'
      }) +
      T.path(arrowHead(tip, p1, stop), C.arrow, {
        stroke: C.arrow,
        'stroke-width': SLOT.HEAD_LINE,
        'stroke-linejoin': 'round'
      }) +
      '</g>'
    );
  }

  T.CLOCK_CENTRE = CENTRE;
  T.handsArt = handsArt;
  T.sliceArt = sliceArt;
  T.arrowArt = arrowArt;
})(window.App);

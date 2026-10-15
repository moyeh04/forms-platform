/** The ship's clock of the ticket picture. */
(function (App) {
  'use strict';

  var T = App.ticket;

  /**
   * A ship's clock: a wooden ring with its grain and four brass knobs, a gold rim, a paper face
   * with 12, 3, 6 and 9 and a mark at every other hour, spear-tipped hands at the start of the
   * slot, and the slot itself as a shaded slice of the dial with a red arrow from the tip of the
   * minute hand round to its end.
   */
  function clockArt(hands, arc) {
    var cx = 118,
      cy = 104;
    var marks = '';
    [1, 2, 4, 5, 7, 8, 10, 11].forEach(function (hr) {
      var a = T.polar(cx, cy, 35.5, hr * 30),
        b = T.polar(cx, cy, 41, hr * 30);
      marks += T.el('line', {
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        stroke: T.C.line,
        'stroke-width': 2.2,
        'stroke-linecap': 'round'
      });
    });
    var numerals = [
      [12, 0],
      [3, 90],
      [6, 180],
      [9, 270]
    ]
      .map(function (n) {
        var p = T.polar(cx, cy, 37, n[1]);
        return (
          '<text x="' +
          p[0] +
          '" y="' +
          (+p[1] + 5).toFixed(1) +
          '" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-weight="700" font-size="14" fill="' +
          T.C.line +
          '">' +
          n[0] +
          '</text>'
        );
      })
      .join('');
    var grain = [
      [61, 200, 250],
      [58, 280, 340],
      [60, 20, 70],
      [57, 110, 160],
      [62, 150, 185],
      [56, 220, 245]
    ]
      .map(function (g) {
        var a = T.polar(cx, cy, g[0], g[1]),
          b = T.polar(cx, cy, g[0], g[2]);
        return T.path(
          'M' +
            a[0] +
            ' ' +
            a[1] +
            'A' +
            g[0] +
            ' ' +
            g[0] +
            ' 0 0 1 ' +
            b[0] +
            ' ' +
            b[1],
          'none',
          {
            stroke: T.C.woodDark,
            'stroke-width': 1.3,
            'stroke-linecap': 'round',
            opacity: '.7'
          }
        );
      })
      .join('');
    var shine = T.polar(cx, cy, 59, 290),
      shine2 = T.polar(cx, cy, 59, 340);
    // A hand points up from the centre and is turned to its angle; it sweeps there from 12 when the ticket appears.
    var hand = function (deg, len, w) {
      var d =
        'M' +
        (cx - w) +
        ' ' +
        (cy + 7) +
        'L' +
        (cx + w) +
        ' ' +
        (cy + 7) +
        'L' +
        (cx + w * 0.55) +
        ' ' +
        (cy - len + 7) +
        'L' +
        (cx + w + 2.4) +
        ' ' +
        (cy - len + 6) +
        'L' +
        cx +
        ' ' +
        (cy - len - 1) +
        'L' +
        (cx - w - 2.4) +
        ' ' +
        (cy - len + 6) +
        'L' +
        (cx - w * 0.55) +
        ' ' +
        (cy - len + 7) +
        'z';
      return (
        '<g class="sweep" style="--from: ' +
        -deg +
        'deg">' +
        T.path(d, T.C.hand, {
          stroke: '#1E130B',
          'stroke-width': 1.1,
          'stroke-linejoin': 'round',
          transform: 'rotate(' + deg + ' ' + cx + ' ' + cy + ')'
        }) +
        '</g>'
      );
    };
    var minute = 31,
      arrow = '',
      slice = '';
    if (arc) {
      var s0 = T.polar(cx, cy, 45, arc[0]),
        s1 = T.polar(cx, cy, 45, arc[1]);
      slice = T.path(
        'M' +
          cx +
          ' ' +
          cy +
          'L' +
          s0[0] +
          ' ' +
          s0[1] +
          'A45 45 0 ' +
          (arc[1] - arc[0] > 180 ? 1 : 0) +
          ' 1 ' +
          s1[0] +
          ' ' +
          s1[1] +
          'z',
        T.C.arrow,
        { 'fill-opacity': '.16', class: 'slice' }
      );
      var r = minute,
        head = 7,
        stop = arc[1] - ((head / r) * 180) / Math.PI;
      var p0 = T.polar(cx, cy, r, arc[0]),
        p1 = T.polar(cx, cy, r, stop),
        tip = T.polar(cx, cy, r, arc[1]);
      var t = (stop * Math.PI) / 180,
        nx = Math.sin(t),
        ny = -Math.cos(t);
      var wing = function (k) {
        return (
          (+p1[0] + nx * 4.6 * k).toFixed(1) +
          ' ' +
          (+p1[1] + ny * 4.6 * k).toFixed(1)
        );
      };
      arrow =
        '<g class="slice">' +
        T.path(
          'M' +
            p0[0] +
            ' ' +
            p0[1] +
            'A' +
            r +
            ' ' +
            r +
            ' 0 ' +
            (stop - arc[0] > 180 ? 1 : 0) +
            ' 1 ' +
            p1[0] +
            ' ' +
            p1[1],
          'none',
          { stroke: T.C.arrow, 'stroke-width': 2.4, 'stroke-linecap': 'round' }
        ) +
        T.path(
          'M' + tip[0] + ' ' + tip[1] + 'L' + wing(1) + 'L' + wing(-1) + 'z',
          T.C.arrow,
          { stroke: T.C.arrow, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }
        ) +
        '</g>';
    }
    return (
      T.shadow(cx, 178, 62) +
      '<g>' +
      T.el('circle', {
        cx: cx,
        cy: cy,
        r: 65,
        fill: T.C.wood,
        stroke: T.C.line,
        'stroke-width': 2.6
      }) +
      T.path(
        'M' +
          (cx - 63) +
          ' ' +
          (cy + 8) +
          'a63 63 0 0 0 126 0a52 52 0 0 1-126 0z',
        T.C.woodDark,
        { opacity: '.45' }
      ) +
      grain +
      T.path(
        'M' +
          shine[0] +
          ' ' +
          shine[1] +
          'A59 59 0 0 1 ' +
          shine2[0] +
          ' ' +
          shine2[1],
        'none',
        {
          stroke: T.C.woodLight,
          'stroke-width': 2.6,
          'stroke-linecap': 'round',
          opacity: '.85'
        }
      ) +
      T.el('circle', {
        cx: cx,
        cy: cy,
        r: 52.5,
        fill: T.C.gold,
        stroke: T.C.line,
        'stroke-width': 2.2
      }) +
      T.el('circle', {
        cx: cx,
        cy: cy,
        r: 50,
        fill: 'none',
        stroke: T.C.goldLight,
        'stroke-width': 1.2,
        opacity: '.9'
      }) +
      T.el('circle', {
        cx: cx,
        cy: cy,
        r: 47,
        fill: T.C.face,
        stroke: T.C.line,
        'stroke-width': 1.8
      }) +
      T.el('circle', {
        cx: cx,
        cy: cy,
        r: 45.3,
        fill: 'none',
        stroke: '#E6D9BC',
        'stroke-width': 2
      }) +
      slice +
      marks +
      numerals +
      arrow +
      (hands ? hand(hands[0], 23, 2.6) + hand(hands[1], minute, 2) : '') +
      T.el('circle', {
        cx: cx,
        cy: cy,
        r: 4.8,
        fill: T.C.gold,
        stroke: T.C.line,
        'stroke-width': 1.6
      }) +
      T.el('circle', {
        cx: cx - 1.4,
        cy: cy - 1.4,
        r: 1.5,
        fill: T.C.goldLight
      }) +
      T.knob(cx, cy - 63, 7.5, true) +
      T.knob(cx, cy + 63, 7.5) +
      T.knob(cx - 64, cy, 5) +
      T.knob(cx + 64, cy, 5) +
      '</g>'
    );
  }

  T.clockArt = clockArt;
})(window.App);

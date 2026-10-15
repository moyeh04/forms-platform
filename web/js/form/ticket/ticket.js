/** The success ticket: reference, the time of a booking, key with a callout, expiry, and ways to keep it. */
(function (App) {
  'use strict';
  var h = App.ui.h;
  var t = function (k, p) {
    return App.i18n.t(k, p);
  };

  function arrowCallout() {
    var svg =
      '<svg viewBox="0 0 44 60" width="40" height="54" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M22 3c7 11-6 23 0 40"/><path d="M11 35l11 12 11-12"/></svg>';
    var s = h('span', { class: 'callout-arrow' });
    s.innerHTML = svg;
    return s;
  }

  function digits(key) {
    // A screen reader hears the digits one by one from the hidden text; the drawn boxes are for the eye.
    return h(
      'div',
      { class: 'key-digits' },
      h('span', { class: 'sr-only' }, key.split('').join(' ')),
      key.split('').map(function (d) {
        return h('span', { class: 'key-digit code', 'aria-hidden': 'true' }, d);
      })
    );
  }

  var NS = 'http://www.w3.org/2000/svg';

  /** The day of a booking as calendar text: month, day number and weekday, or only the label of a day with no date. */
  function calendarText(day) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day.date || ''));
    if (!m) return { head: t('slotDay'), big: '', sub: day.label };
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    var fmt = function (o) {
      try {
        return d.toLocaleDateString(
          App.i18n.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB',
          Object.assign({ timeZone: 'UTC' }, o)
        );
      } catch (e) {
        return '';
      }
    };
    return {
      head: fmt({ month: 'long' }),
      big: String(+m[3]),
      sub: fmt({ weekday: 'long' })
    };
  }

  /** The hands of a clock at the start of a time like "12:30 - 12:50", as [hour angle, minute angle]. */
  function handAngles(time) {
    var m = /(\d{1,2}):(\d{2})/.exec(String(time || ''));
    if (!m) return null;
    var hr = +m[1] % 12,
      min = +m[2];
    return [hr * 30 + min / 2, min * 6];
  }

  /**
   * The part of the dial a slot covers, as [from, to] in degrees clockwise from 12. A slot of
   * under an hour is marked on the minutes ("12:55 - 1:15" is 330 to 450); a longer one on the hours.
   */
  function slotArc(time) {
    var m = /(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/.exec(String(time || ''));
    if (!m) return null;
    var from = (+m[1] % 12) * 60 + +m[2],
      to = (+m[3] % 12) * 60 + +m[4];
    var length = (to - from + 720) % 720;
    if (!length) return null;
    return length < 60
      ? [(from % 60) * 6, (from % 60) * 6 + length * 6]
      : [from / 2, from / 2 + length / 2];
  }

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

  /**
   * A desk calendar: a red band with rounded top, a light line and a dark strip, two gold rings
   * through it, pages stacked behind at the right, and the bottom left corner curled up. It is
   * drawn at the left edge and moved to its place at the right of the picture, raised so the
   * pirate's hook points at the day.
   */
  function calendarArt() {
    var o = { stroke: C.line, 'stroke-width': 2.4, 'stroke-linejoin': 'round' };
    var ring = function (x) {
      return (
        el('ellipse', {
          cx: x,
          cy: 46,
          rx: 6.4,
          ry: 9.6,
          fill: C.gold,
          stroke: C.line,
          'stroke-width': 2.2
        }) +
        el('ellipse', {
          cx: x + 0.6,
          cy: 46.5,
          rx: 2.4,
          ry: 5.6,
          fill: '#5E1D18',
          stroke: C.line,
          'stroke-width': 1.4
        }) +
        path('M' + (x - 4.2) + ' 41c-.8 3-.8 8 0 11', 'none', {
          stroke: C.goldLight,
          'stroke-width': 1.6,
          'stroke-linecap': 'round'
        })
      );
    };
    return (
      '<g transform="translate(292 -26)">' +
      shadow(74, 172, 64) +
      // The pages behind, seen only at the right edge.
      path('M14 74h116v84a6 6 0 0 1-6 6H14z', C.page, o) +
      path('M14 74h113v86a6 6 0 0 1-6 6H14z', C.page, o) +
      // The front page, cut at the corner that curls.
      path('M14 74h110v88a6 6 0 0 1-6 6H37l-23-22z', C.paper, o) +
      // The curl: the back of the corner, lifted and rolled toward the page.
      path(
        'M14 146c5 2 9 5 11 9c2 4 3 9 12 13c-6 1-12-1-16-5c-4-4-6-10-7-17z',
        '#EADFC6',
        o
      ) +
      path('M18 151c2 3 4 7 6 10', 'none', {
        stroke: '#CDBF9F',
        'stroke-width': 1.2,
        'stroke-linecap': 'round'
      }) +
      // The band over the whole width, with its light line and dark strip.
      path('M14 56a10 10 0 0 1 10-10h96a10 10 0 0 1 10 10v22H14z', C.red, o) +
      path('M15.3 72.5h113.4v4.3H15.3z', C.redDark) +
      path('M22 50.5h92', 'none', {
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
      var a = polar(cx, cy, 35.5, hr * 30),
        b = polar(cx, cy, 41, hr * 30);
      marks += el('line', {
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        stroke: C.line,
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
        var p = polar(cx, cy, 37, n[1]);
        return (
          '<text x="' +
          p[0] +
          '" y="' +
          (+p[1] + 5).toFixed(1) +
          '" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-weight="700" font-size="14" fill="' +
          C.line +
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
        var a = polar(cx, cy, g[0], g[1]),
          b = polar(cx, cy, g[0], g[2]);
        return path(
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
            stroke: C.woodDark,
            'stroke-width': 1.3,
            'stroke-linecap': 'round',
            opacity: '.7'
          }
        );
      })
      .join('');
    var shine = polar(cx, cy, 59, 290),
      shine2 = polar(cx, cy, 59, 340);
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
        path(d, C.hand, {
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
      var s0 = polar(cx, cy, 45, arc[0]),
        s1 = polar(cx, cy, 45, arc[1]);
      slice = path(
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
        C.arrow,
        { 'fill-opacity': '.16', class: 'slice' }
      );
      var r = minute,
        head = 7,
        stop = arc[1] - ((head / r) * 180) / Math.PI;
      var p0 = polar(cx, cy, r, arc[0]),
        p1 = polar(cx, cy, r, stop),
        tip = polar(cx, cy, r, arc[1]);
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
        path(
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
          { stroke: C.arrow, 'stroke-width': 2.4, 'stroke-linecap': 'round' }
        ) +
        path(
          'M' + tip[0] + ' ' + tip[1] + 'L' + wing(1) + 'L' + wing(-1) + 'z',
          C.arrow,
          { stroke: C.arrow, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }
        ) +
        '</g>';
    }
    return (
      shadow(cx, 178, 62) +
      '<g>' +
      el('circle', {
        cx: cx,
        cy: cy,
        r: 65,
        fill: C.wood,
        stroke: C.line,
        'stroke-width': 2.6
      }) +
      path(
        'M' +
          (cx - 63) +
          ' ' +
          (cy + 8) +
          'a63 63 0 0 0 126 0a52 52 0 0 1-126 0z',
        C.woodDark,
        { opacity: '.45' }
      ) +
      grain +
      path(
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
          stroke: C.woodLight,
          'stroke-width': 2.6,
          'stroke-linecap': 'round',
          opacity: '.85'
        }
      ) +
      el('circle', {
        cx: cx,
        cy: cy,
        r: 52.5,
        fill: C.gold,
        stroke: C.line,
        'stroke-width': 2.2
      }) +
      el('circle', {
        cx: cx,
        cy: cy,
        r: 50,
        fill: 'none',
        stroke: C.goldLight,
        'stroke-width': 1.2,
        opacity: '.9'
      }) +
      el('circle', {
        cx: cx,
        cy: cy,
        r: 47,
        fill: C.face,
        stroke: C.line,
        'stroke-width': 1.8
      }) +
      el('circle', {
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
      el('circle', {
        cx: cx,
        cy: cy,
        r: 4.8,
        fill: C.gold,
        stroke: C.line,
        'stroke-width': 1.6
      }) +
      el('circle', { cx: cx - 1.4, cy: cy - 1.4, r: 1.5, fill: C.goldLight }) +
      knob(cx, cy - 63, 7.5, true) +
      knob(cx, cy + 63, 7.5) +
      knob(cx - 64, cy, 5) +
      knob(cx + 64, cy, 5) +
      '</g>'
    );
  }

  /**
   * The time of a booking as a picture: the parrot points at the time on a clock, and the pirate
   * points his hook at the day on a calendar. The words are page text over the drawing, so they are read out
   * and kept in the saved image; the drawing itself is hidden from the reader.
   */
  function when(w) {
    var cal = calendarText(w.day);
    var art = document.createElementNS(NS, 'svg');
    art.setAttribute('viewBox', '0 0 440 220');
    art.setAttribute('class', 'when-art');
    art.setAttribute('aria-hidden', 'true');
    // One picture for both languages: a clock or a calendar read backwards would be wrong.
    art.innerHTML =
      el('rect', {
        x: 1,
        y: 1,
        width: 438,
        height: 218,
        rx: 12,
        class: 'when-card',
        stroke: '#CDBB94',
        'stroke-width': 1.5,
        'stroke-dasharray': '5 4'
      }) +
      clockArt(handAngles(w.time), slotArc(w.time)) +
      calendarArt();
    var figure = function (name) {
      return h('img', {
        class: 'when-' + name,
        src: 'assets/img/' + name + '.webp',
        alt: '',
        'aria-hidden': 'true',
        draggable: 'false'
      });
    };
    return h(
      'div',
      { class: 'when', name: 'when' },
      art,
      figure('pirate'),
      figure('parrot'),
      h('div', { class: 'when-head' }, cal.head),
      h(
        'div',
        { class: 'when-cal-text' },
        cal.big ? h('span', { class: 'when-big' }, cal.big) : null,
        h('span', { class: 'when-sub' + (cal.big ? '' : ' only') }, cal.sub)
      ),
      h('div', { class: 'when-time code' }, h('span', { dir: 'ltr' }, w.time))
    );
  }

  /** summary: [{ label, value }] rows shown under the key. when: { day, time } of a booking, drawn under the title. */
  function render(o) {
    var kids = [
      h(
        'h2',
        { class: 'ticket-title' },
        t(o.edited ? 'savedTitle' : 'ticketTitle')
      ),
      h(
        'p',
        { class: 'ticket-ref' },
        h('span', { class: 'muted' }, t('ticketRef') + '  '),
        h('span', { class: 'code' }, o.ref)
      )
    ];
    if (o.when) kids.push(when(o.when));
    if (o.key) {
      kids.push(
        h(
          'div',
          { class: 'key-block' },
          h(
            'div',
            { class: 'key-note' },
            h('span', { class: 'key-note-text' }, t('ticketKeyNote')),
            arrowCallout()
          ),
          h('p', { class: 'key-label' }, t('ticketKey')),
          digits(o.key),
          h(
            'p',
            { class: 'help' },
            t('ticketValid', { date: App.i18n.fmtDate(o.keyExpires) })
          )
        ),
        h('p', { class: 'shot-note' }, t('ticketShot'))
      );
    } else if (o.teamKey) {
      kids.push(
        h('p', { class: 'help', name: 'team-key-note' }, t('ticketTeamKey'))
      );
    } else if (!o.edited && !o.when) {
      kids.push(h('p', null, t('ticketNoKey')));
    }
    if (o.email)
      kids.push(h('p', { class: 'help' }, t('emailSent', { email: o.email })));
    if (o.summary && o.summary.length) {
      kids.push(
        h(
          'dl',
          { class: 'summary' },
          o.summary.map(function (r) {
            return [h('dt', null, r.label), h('dd', null, r.value)];
          })
        )
      );
    }
    return h('section', { class: 'ticket', id: 'ticket' }, kids);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /** Cuts the zigzag of the ticket's top and bottom edges out of a saved image, as the page shows them. */
  function tearEdges(canvas, scale) {
    var g = canvas.getContext('2d'),
      w = canvas.width,
      tooth = 18 * scale,
      deep = 9 * scale;
    // html2canvas leaves its own scale and page offset on the context; the cut is in canvas pixels.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    for (var x = 0; x < w; x += tooth) {
      g.moveTo(x, 0);
      g.lineTo(x + tooth / 2, deep);
      g.lineTo(x + tooth, 0);
      g.moveTo(x, canvas.height);
      g.lineTo(x + tooth / 2, canvas.height - deep);
      g.lineTo(x + tooth, canvas.height);
    }
    g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  async function saveImage(node, name) {
    if (!window.html2canvas)
      await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      );
    var cs = getComputedStyle(document.body);
    var canvas = await window.html2canvas(node, {
      backgroundColor: cs.backgroundColor,
      scale: 2,
      useCORS: true,
      // The copy is drawn at once, so its hands and slice are drawn where they stop.
      onclone: function (doc) {
        doc.documentElement.classList.add('still');
      }
    });
    tearEdges(canvas, 2);
    var a = document.createElement('a');
    a.download = (name || 'registration') + '.png';
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /** Buttons under the ticket. */
  function actions(o) {
    var copyBtn = o.key
      ? h(
          'button',
          {
            type: 'button',
            class: 'btn btn-quiet',
            onclick: async function (e) {
              var ok = await App.ui.copyText(o.key);
              if (ok) App.ui.toast(t('copied'), 'ok');
            }
          },
          App.ui.icon('copy', 20),
          t('copyKey')
        )
      : null;
    return h(
      'div',
      { class: 'ticket-actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-primary',
          onclick: async function () {
            try {
              await saveImage(document.getElementById('ticket'), o.ref);
            } catch (e) {
              App.ui.toast(t('imageFail'), 'err');
            }
          }
        },
        App.ui.icon('download', 20),
        t('saveImage')
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet',
          onclick: function () {
            window.print();
          }
        },
        App.ui.icon('printer', 20),
        t('savePdf')
      ),
      copyBtn
    );
  }

  App.ticket = {
    render: render,
    actions: actions,
    saveImage: saveImage,
    handAngles: handAngles,
    slotArc: slotArc
  };
})((window.App = window.App || {}));

/**
 * The time of a booking as a picture: the parrot points at the time on a
 * clock, and the pirate points his hook at the day on a calendar. The words
 * are page text over the drawing, so they are read out and kept in the
 * saved image; the drawing itself is hidden from the reader.
 */
(function (App) {
  'use strict';

  var T = App.ticket;
  var h = App.ui.h;

  /** The namespace of an SVG element. */
  var NS = 'http://www.w3.org/2000/svg';

  /** A date as the form stores it, such as 2026-11-14. */
  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

  /** The card of parchment the picture is drawn on. */
  var CARD = {
    VIEW: '0 0 440 220',
    X: 1,
    Y: 1,
    WIDTH: 438,
    HEIGHT: 218,
    CORNER: 12,
    LINE: 1.5,
    DASH: '5 4'
  };

  /**
   * Looks up a sentence in the language of the page.
   *
   * @param {string} k The key.
   * @param {!Object=} p The values it takes.
   * @return {string} The sentence.
   */
  function t(k, p) {
    return App.i18n.t(k, p);
  }

  /**
   * Writes a date in the language of the page.
   *
   * @param {!Date} d The date, at midnight UTC.
   * @param {!Object} o What to write of it, as toLocaleDateString takes.
   * @return {string} The text, or '' when the browser cannot write it.
   */
  function dateText(d, o) {
    var locale = App.i18n.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
    try {
      return d.toLocaleDateString(
        locale,
        Object.assign({ timeZone: 'UTC' }, o)
      );
    } catch {
      return '';
    }
  }

  /**
   * Writes the day of a booking as calendar text: the month, the day
   * number and the weekday, or only the label of a day with no date.
   *
   * @param {!Object} day The day.
   * @return {{head: string, big: string, sub: string}} The text.
   */
  function calendarText(day) {
    var m = ISO_DATE.exec(String(day.date || ''));
    if (!m) return { head: t('slotDay'), big: '', sub: day.label };
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return {
      head: dateText(d, { month: 'long' }),
      big: String(+m[3]),
      sub: dateText(d, { weekday: 'long' })
    };
  }

  /**
   * Draws the clock and the calendar on their card. One picture serves
   * both languages: a clock or a calendar read backwards would be wrong.
   *
   * @param {string} time The time of the booking.
   * @return {!Element} The picture.
   */
  function art(time) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', CARD.VIEW);
    svg.setAttribute('class', 'when-art');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      T.el('rect', {
        x: CARD.X,
        y: CARD.Y,
        width: CARD.WIDTH,
        height: CARD.HEIGHT,
        rx: CARD.CORNER,
        class: 'when-card',
        stroke: T.COLORS.cardLine,
        'stroke-width': CARD.LINE,
        'stroke-dasharray': CARD.DASH
      }) +
      T.clockArt(T.handAngles(time), T.slotArc(time)) +
      T.calendarArt();
    return svg;
  }

  /**
   * Draws the pirate or the parrot.
   *
   * @param {string} name The drawing.
   * @return {!Element} The image.
   */
  function figure(name) {
    return h('img', {
      class: 'when-' + name,
      src: 'assets/img/' + name + '.webp',
      alt: '',
      'aria-hidden': 'true',
      draggable: 'false'
    });
  }

  /**
   * Draws the time of a booking.
   *
   * @param {{day: !Object, time: string}} w The booking.
   * @return {!Element} The picture with its words.
   */
  function when(w) {
    var cal = calendarText(w.day);
    return h(
      'div',
      { class: 'when', name: 'when' },
      art(w.time),
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

  T.when = when;
})(window.App);

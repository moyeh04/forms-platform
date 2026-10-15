/** The time of a booking as a picture. */
(function (App) {
  'use strict';

  var T = App.ticket;
  var h = App.ui.h;
  var t = T.t;

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
      T.el('rect', {
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
      T.clockArt(T.handAngles(w.time), T.slotArc(w.time)) +
      T.calendarArt();
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

  T.when = when;
})(window.App);

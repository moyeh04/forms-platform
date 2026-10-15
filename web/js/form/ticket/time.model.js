/** The time of a booking as the ticket draws it. */
(function (App) {
  'use strict';

  var h = App.ui.h;

  var t = function (k, p) {
    return App.i18n.t(k, p);
  };

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

  var T = { h: h, t: t };
  App.ticket = T;

  T.handAngles = handAngles;
  T.slotArc = slotArc;
})(window.App);

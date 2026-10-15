/**
 * The state of the timetable of a reservation form and the rules it
 * follows, shared by the timetable parts as `A.tt`.
 *
 * The saved shape does not change: `slots.days` is a list of
 * `{id, label, date, times}` and `slots.pattern` is the general hours.
 * Everything else here is worked out from that when the page opens. A day
 * follows the general hours unless it has its own: `d._own` is its own
 * `{start, end}`; `d._kept` is a list of times saved earlier that no hours
 * explain, shown as they are; `d._off` lists the times switched off.
 * `d.times` is always the slots that are on.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var Rules = window.Rules;
  var TT = {};
  A.tt = TT;

  /** The general hours of a timetable that has none yet. */
  var DEFAULT_PATTERN = { start: '12:30', end: '15:30', length: 20, gap: 5 };

  /** How many teams can book the same slot. */
  TT.CAPACITY = { MIN: 1, MAX: 50 };

  /**
   * Writes a number with two digits.
   *
   * @param {number} n The number.
   * @return {string} "07", "12".
   */
  function p2(n) {
    return ('0' + n).slice(-2);
  }

  /**
   * Writes a day as YYYY-MM-DD.
   *
   * @param {number} y The year.
   * @param {number} m The month, from 0.
   * @param {number} d The day of the month.
   * @return {string} The day.
   */
  TT.iso = function (y, m, d) {
    return y + '-' + p2(m + 1) + '-' + p2(d);
  };

  /**
   * Gives the local day of today.
   *
   * @return {string} The day as YYYY-MM-DD.
   */
  TT.today = function () {
    var d = new Date();
    return TT.iso(d.getFullYear(), d.getMonth(), d.getDate());
  };

  /**
   * Gives the bookings per slot.
   *
   * @param {!Object} t The timetable.
   * @return {number} At least 1.
   */
  TT.capacity = function (t) {
    return t.f.slots.capacity || TT.CAPACITY.MIN;
  };

  /**
   * Lists the times a day offers: its kept times, or the slots of its own
   * or the general hours.
   *
   * @param {!Object} t The timetable.
   * @param {!Object} d The day.
   * @return {!Array<string>} The times.
   */
  TT.offered = function (t, d) {
    if (d._kept) return d._kept;
    return Rules.generateSlots(
      d._own ? Object.assign({}, t.pat, d._own) : t.pat
    );
  };

  /**
   * Works out the times of a day that are on.
   *
   * @param {!Object} t The timetable.
   * @param {!Object} d The day, changed in place.
   */
  TT.settle = function (t, d) {
    d.times = TT.offered(t, d).filter(function (tm) {
      return d._off.indexOf(tm) === -1;
    });
  };

  /**
   * Switches all the times of a day on again, after its hours changed.
   *
   * @param {!Object} t The timetable.
   * @param {!Object} d The day, changed in place.
   */
  TT.reset = function (t, d) {
    d._off = [];
    TT.settle(t, d);
  };

  /**
   * Works out how a saved day is shown: which general slots it switched
   * off, or the times it keeps when no hours explain them.
   *
   * @param {!Array<string>} all The slots of the general hours.
   * @param {!Object} d The day, changed in place.
   */
  function readDay(all, d) {
    var general = d.times.every(function (tm) {
      return all.indexOf(tm) !== -1;
    });
    d._off = [];
    if (general) {
      d._off = all.filter(function (tm) {
        return d.times.indexOf(tm) === -1;
      });
    } else {
      d._kept = d.times.slice();
    }
    d._named = !!d.label && d.label !== Rules.dayLabel(d.date);
  }

  /**
   * Orders two days: dated days by date, then the days with no date.
   *
   * @param {!Object} a A day.
   * @param {!Object} b Another day.
   * @return {number} Below 0 when a comes first.
   */
  function byDate(a, b) {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    return b.date ? 1 : 0;
  }

  /**
   * Puts the days in order.
   *
   * @param {!Object} t The timetable.
   */
  TT.sortDays = function (t) {
    t.days.sort(byDate);
  };

  /**
   * Counts the bookings of one time of a day.
   *
   * @param {!Object} t The timetable.
   * @param {!Object} d The day.
   * @param {string} tm The time.
   * @return {number} The bookings.
   */
  TT.booked = function (t, d, tm) {
    return d.id ? t.taken[Rules.slotKey(d.id, tm)] || 0 : 0;
  };

  /**
   * Counts the bookings of a day.
   *
   * @param {!Object} t The timetable.
   * @param {!Object} d The day.
   * @return {number} The bookings.
   */
  TT.bookedOn = function (t, d) {
    return Object.keys(t.taken)
      .filter(function (k) {
        return d.id && k.indexOf(d.id + '|') === 0;
      })
      .reduce(function (n, k) {
        return n + t.taken[k];
      }, 0);
  };

  /**
   * Counts the bookings whose day or time is no longer offered.
   *
   * @param {!Object} t The timetable.
   * @return {number} The bookings.
   */
  TT.orphans = function (t) {
    var kept = {};
    t.days.forEach(function (d) {
      if (!d.id) return;
      d.times.forEach(function (tm) {
        kept[Rules.slotKey(d.id, tm)] = true;
      });
    });
    return Object.keys(t.taken).reduce(function (n, k) {
      return kept[k] ? n : n + t.taken[k];
    }, 0);
  };

  /**
   * Counts the slots that are on, over all days.
   *
   * @param {!Object} t The timetable.
   * @return {number} The slots.
   */
  TT.slotCount = function (t) {
    return t.days.reduce(function (n, d) {
      return n + d.times.length;
    }, 0);
  };

  /**
   * Adds a dated day, or removes it when it is there.
   *
   * @param {!Object} t The timetable.
   * @param {string} date The day as YYYY-MM-DD.
   */
  TT.toggleDate = function (t, date) {
    var at = t.days
      .map(function (d) {
        return d.date;
      })
      .indexOf(date);
    if (at !== -1) {
      t.days.splice(at, 1);
      return;
    }
    var d = { label: Rules.dayLabel(date), date: date, times: [], _off: [] };
    TT.settle(t, d);
    t.days.push(d);
    TT.sortDays(t);
  };

  /**
   * Adds a day with no date, to be named.
   *
   * @param {!Object} t The timetable.
   */
  TT.addUndated = function (t) {
    var d = { label: '', date: '', times: [], _off: [], _named: true };
    TT.settle(t, d);
    t.days.push(d);
  };

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} t The timetable.
   * @return {string} The days, the slots and the bookings per slot.
   */
  TT.summary = function (t) {
    if (!t.days.length) return 'No days yet';
    return (
      A.plural(t.days.length, 'day', 'days') +
      ' · ' +
      A.plural(TT.slotCount(t), 'slot', 'slots') +
      ' · ' +
      A.plural(TT.capacity(t), 'booking', 'bookings') +
      ' per slot'
    );
  };

  /**
   * Gives the first thing that stops a save.
   *
   * @param {!Object} t The timetable.
   * @return {string} The reason, or ''.
   */
  TT.problem = function (t) {
    var unnamed = t.days.some(function (d) {
      return !String(d.label || '').trim();
    });
    if (unnamed) return 'Give every day a date or a name.';
    var empty = t.days.filter(function (d) {
      return !d.times.length;
    })[0];
    return empty ? '"' + empty.label + '" has no time slots.' : '';
  };

  /**
   * Gives the timetable as the server stores it.
   *
   * @param {!Object} t The timetable.
   * @return {!Object} `capacity`, `pattern` and `days`.
   */
  TT.slots = function (t) {
    var pat = t.pat;
    return {
      capacity: TT.capacity(t),
      pattern: {
        start: pat.start,
        end: pat.end,
        length: pat.length,
        gap: pat.gap
      },
      days: t.days.map(function (d) {
        return {
          id: d.id,
          label: d.label,
          date: d.date,
          times: d.times.slice()
        };
      })
    };
  };

  /**
   * Reads the timetable of a form. Missing parts are filled in on the form.
   *
   * @param {!Object} f The form, changed in place.
   * @param {?Object=} taken The bookings of each saved slot, by
   *     Rules.slotKey(day id, time).
   * @return {!Object} The timetable: `f`, `pat`, `days`, `taken`.
   */
  TT.read = function (f, taken) {
    f.slots = f.slots || { days: [], capacity: TT.CAPACITY.MIN };
    f.slots.pattern = Object.assign({}, DEFAULT_PATTERN, f.slots.pattern || {});
    var t = {
      f: f,
      pat: f.slots.pattern,
      days: f.slots.days,
      taken: taken || {}
    };
    var all = Rules.generateSlots(t.pat);
    t.days.forEach(function (d) {
      readDay(all, d);
    });
    TT.sortDays(t);
    return t;
  };
})(window.App);

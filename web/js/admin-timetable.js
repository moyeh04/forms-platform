/**
 * The timetable of a reservation form: pick the dates on a calendar, set the hours once,
 * and read the result as one row of slots for each day.
 *
 * The saved shape does not change: `slots.days` is a list of { id, label, date, times } and
 * `slots.pattern` is the general hours. Everything else here (which slots are switched off,
 * a day with its own hours) is worked out from that when the page opens.
 */
(function (App) {
  'use strict';
  var A = App.admin, ui = App.ui, h = ui.h, icon = ui.icon, Rules = window.Rules;

  var WEEK = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']; // The teaching week starts on Saturday.
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function p2(n) { return ('0' + n).slice(-2); }
  function iso(y, m, d) { return y + '-' + p2(m + 1) + '-' + p2(d); }
  function today() { var d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /**
   * Returns { node, summary(), problem(), slots() } for the form `f`. `taken` counts the
   * bookings of each saved slot, by Rules.slotKey(day id, time).
   */
  A.timetable = function (f, taken) {
    f.slots = f.slots || { days: [], capacity: 1 };
    taken = taken || {};
    var pat = f.slots.pattern = Object.assign({ start: '12:30', end: '15:30', length: 20, gap: 5 }, f.slots.pattern || {});
    var days = f.slots.days;
    var general = function () { return Rules.generateSlots(pat); };

    /*
     * A day follows the general hours unless it has its own. `d._own` is its own { start, end };
     * `d._kept` is a list of times saved earlier that no hours explain, shown as they are.
     * `d._off` lists the times switched off. `d.times` is always the slots that are on.
     */
    function offered(d) { return d._kept || Rules.generateSlots(d._own ? Object.assign({}, pat, d._own) : pat); }
    function settle(d) { d.times = offered(d).filter(function (tm) { return d._off.indexOf(tm) === -1; }); }
    days.forEach(function (d) {
      var all = general();
      d._off = [];
      if (d.times.every(function (tm) { return all.indexOf(tm) !== -1; })) d._off = all.filter(function (tm) { return d.times.indexOf(tm) === -1; });
      else d._kept = d.times.slice();
      d._named = !!d.label && d.label !== Rules.dayLabel(d.date);
    });
    function sortDays() {
      days.sort(function (a, b) { return a.date && b.date ? a.date.localeCompare(b.date) : a.date ? -1 : b.date ? 1 : 0; });
    }
    function booked(d, tm) { return d.id ? (taken[Rules.slotKey(d.id, tm)] || 0) : 0; }
    function bookedOn(d) { return Object.keys(taken).filter(function (k) { return d.id && k.indexOf(d.id + '|') === 0; }).reduce(function (n, k) { return n + taken[k]; }, 0); }
    /** Bookings whose day or time is no longer offered. */
    function orphans() {
      var kept = {};
      days.forEach(function (d) { if (d.id) d.times.forEach(function (tm) { kept[Rules.slotKey(d.id, tm)] = true; }); });
      return Object.keys(taken).reduce(function (n, k) { return kept[k] ? n : n + taken[k]; }, 0);
    }

    var resultBox = h('div', { class: 'tt-result' });
    var calBox = h('div', { class: 'tt-cal' });
    var hoursNote = h('p', { class: 'muted-note', role: 'status' });
    var start = (days.filter(function (d) { return d.date; }).pop() || {}).date || today();
    var view = { y: +start.slice(0, 4), m: +start.slice(5, 7) - 1 };

    /* ── Days: a month calendar; a click adds the date, another click removes it ── */

    function toggleDate(date) {
      var at = days.map(function (d) { return d.date; }).indexOf(date);
      if (at !== -1) days.splice(at, 1);
      else {
        var d = { label: Rules.dayLabel(date), date: date, times: [], _off: [] };
        settle(d);
        days.push(d);
        sortDays();
      }
      paint();
    }

    function paintCal() {
      ui.clear(calBox);
      var first = new Date(Date.UTC(view.y, view.m, 1));
      var lead = (first.getUTCDay() + 1) % 7; // Columns start on Saturday.
      var count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
      var move = function (by) { var d = new Date(Date.UTC(view.y, view.m + by, 1)); view = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; paintCal(); };
      var cells = [];
      for (var i = 0; i < lead; i++) cells.push(h('span', { class: 'tt-cal-gap' }));
      for (var n = 1; n <= count; n++) (function (n) {
        var date = iso(view.y, view.m, n);
        var day = days.filter(function (d) { return d.date === date; })[0];
        var has = day ? bookedOn(day) : 0;
        cells.push(h('button', { type: 'button', class: 'tt-cal-day' + (date === today() ? ' today' : '') + (has ? ' has-bookings' : ''), name: 'cal-' + date, 'aria-pressed': day ? 'true' : 'false',
          'aria-label': Rules.dayLabel(date) + (day ? ', in the timetable' : ''), title: has ? plural(has, 'booking', 'bookings') + ' on this day' : null, onclick: function () { toggleDate(date); } }, String(n)));
      })(n);
      calBox.appendChild(h('div', { class: 'tt-cal-head' },
        h('button', { type: 'button', class: 'icon-btn sm', name: 'cal-prev', 'aria-label': 'Month before', onclick: function () { move(-1); } }, '‹'),
        h('strong', { class: 'tt-cal-month', 'aria-live': 'polite' }, MONTHS[view.m] + ' ' + view.y),
        h('button', { type: 'button', class: 'icon-btn sm', name: 'cal-next', 'aria-label': 'Month after', onclick: function () { move(1); } }, '›')));
      calBox.appendChild(h('div', { class: 'tt-cal-grid' }, WEEK.map(function (w) { return h('span', { class: 'tt-cal-dow' }, w); }), cells));
    }

    /* ── Hours: one row that every day follows ── */

    function num(key, label, unit, min, max) {
      var input = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: String(min), max: String(max), name: 'hours-' + key, value: String(pat[key]), oninput: function (e) {
        var v = parseInt(e.target.value, 10);
        if (isNaN(v) || v < min || v > max) return;
        pat[key] = v; hoursChanged();
      } });
      return h('label', { class: 'field-row' }, h('span', { class: 'label' }, label), h('span', { class: 'tt-unit' }, input, unit));
    }
    function time(key, label) {
      return A.field(label, h('input', { class: 'input', type: 'time', name: 'hours-' + key, value: pat[key], oninput: function (e) { if (e.target.value) { pat[key] = e.target.value; hoursChanged(); } } }));
    }
    function hoursChanged() {
      // New hours give new slots, so a slot switched off under the old hours has no meaning now.
      days.forEach(function (d) { if (!d._kept) { d._off = []; settle(d); } });
      paint();
    }
    var capVal = h('output', { class: 'stepper-val', name: 'capacity' }, String(f.slots.capacity || 1));
    function step(by) { f.slots.capacity = Math.max(1, Math.min(50, (f.slots.capacity || 1) + by)); capVal.textContent = String(f.slots.capacity); paintResult(); }

    /* ── Result: one row for each day, its slots as chips ── */

    function dayRow(d, i) {
      var times = offered(d);
      var count = bookedOn(d);
      var ownOpen = !!d._own;
      var name = h('div', { class: 'tt-row-name' });
      if (d.date && !d._rename) {
        name.appendChild(h('strong', null, d.label));
        name.appendChild(h('button', { type: 'button', class: 'link-btn', name: 'rename-day-' + i, onclick: function () { d._rename = true; paintResult(); var el = resultBox.querySelector('[name="day-name-' + i + '"]'); if (el && el.focus) el.focus(); } }, 'Rename'));
      } else {
        name.appendChild(h('input', { class: 'input', type: 'text', name: 'day-name-' + i, value: d.label, placeholder: 'Name of this day, for example Week 11 - Sunday', 'aria-label': 'Name of day ' + (i + 1),
          oninput: function (e) { d.label = e.target.value; d._named = true; } }));
      }
      var chips = times.map(function (tm, k) {
        var on = d.times.indexOf(tm) !== -1, n = booked(d, tm);
        return h('button', { type: 'button', class: 'tt-slot' + (n ? ' booked' : ''), name: 'slot-' + i + '-' + k, 'aria-pressed': on ? 'true' : 'false',
          title: (on ? 'Click to switch this time off' : 'Click to switch this time on') + (n ? '. ' + plural(n, 'team has', 'teams have') + ' booked it.' : ''), onclick: function () {
            if (on) d._off.push(tm); else d._off = d._off.filter(function (x) { return x !== tm; });
            settle(d); paintResult();
          } }, tm, n ? h('span', { class: 'tt-slot-n' }, String(n)) : null);
      });
      var own = ownOpen ? h('div', { class: 'tt-own' },
        A.field('This day starts', h('input', { class: 'input', type: 'time', name: 'day-start-' + i, value: d._own.start, oninput: function (e) { if (e.target.value) { d._own.start = e.target.value; d._off = []; settle(d); paintResult(); } } })),
        A.field('and ends by', h('input', { class: 'input', type: 'time', name: 'day-end-' + i, value: d._own.end, oninput: function (e) { if (e.target.value) { d._own.end = e.target.value; d._off = []; settle(d); paintResult(); } } })),
        h('button', { type: 'button', class: 'link-btn', name: 'general-hours-' + i, onclick: function () { delete d._own; d._off = []; settle(d); paintResult(); } }, 'Use the general hours')) : null;
      return h('div', { class: 'tt-row' + (d.times.length ? '' : ' bad'), dataset: { day: d.date || d.label } },
        h('div', { class: 'tt-row-head' }, name,
          h('span', { class: 'muted-note' }, plural(d.times.length, 'slot', 'slots') + (count ? ' · ' + count + ' booked' : '')),
          h('span', { class: 'tt-row-tools' },
            ownOpen ? null : h('button', { type: 'button', class: 'link-btn', name: 'own-hours-' + i, onclick: function () {
              // Asking for own hours also replaces times that no hours explain.
              delete d._kept; d._own = { start: pat.start, end: pat.end }; d._off = []; settle(d); paintResult();
            } }, d._kept ? 'Set hours for this day' : 'Different hours'),
            h('button', { type: 'button', class: 'icon-btn sm', name: 'remove-day-' + i, 'aria-label': 'Remove ' + (d.label || 'this day'), onclick: function () { days.splice(i, 1); paint(); } }, icon('trash', 16)))),
        own,
        times.length ? h('div', { class: 'tt-slots' }, chips) : h('p', { class: 'error' }, 'These hours leave no room for a slot. Make the day longer or the slot shorter.'));
    }

    function paintResult() {
      ui.clear(resultBox);
      var slots = days.reduce(function (n, d) { return n + d.times.length; }, 0);
      resultBox.appendChild(h('div', { class: 'tt-result-head' }, h('h3', null, 'What students can book'),
        days.length ? h('span', { class: 'muted-note' }, plural(days.length, 'day', 'days') + ' · ' + plural(slots, 'slot', 'slots') + ' · ' + plural(slots * (f.slots.capacity || 1), 'booking', 'bookings') + ' at most') : null));
      var lost = orphans();
      if (lost) resultBox.appendChild(h('div', { class: 'banner', role: 'alert', name: 'orphans' }, plural(lost, 'booking is', 'bookings are') + ' on a day or a time that is no longer here. Put it back, or tell ' + (lost === 1 ? 'that team' : 'those teams') + ' to book again.'));
      if (!days.length) {
        resultBox.appendChild(h('div', { class: 'empty' }, h('strong', null, 'No days yet.'), ' Click a date in the calendar to offer it. Each day gets the hours you set.'));
        return;
      }
      days.forEach(function (d, i) { resultBox.appendChild(dayRow(d, i)); });
      resultBox.appendChild(h('p', { class: 'muted-note' }, 'Click a time to switch it off for that day. A number on a time is how many teams booked it.'));
    }

    function paintHours() {
      var all = general();
      hoursNote.textContent = all.length ? plural(all.length, 'slot', 'slots') + ' a day: ' + all[0] + (all.length > 1 ? ' to ' + all[all.length - 1] : '') : 'These hours leave no room for a slot.';
      hoursNote.classList.toggle('error', !all.length);
    }
    function paint() { paintCal(); paintHours(); paintResult(); }

    var node = h('div', { class: 'tt l-split' },
      h('div', { class: 'l-side tt-setup l-stack' },
        h('section', { class: 'tt-card' },
          h('div', { class: 'tt-step-head' }, h('span', { class: 'tt-num' }, '1'), h('div', null, h('h3', null, 'Days'), h('p', { class: 'help' }, 'Click a date to offer it. Click it again to remove it.'))),
          calBox,
          h('button', { type: 'button', class: 'link-btn', name: 'add-undated', onclick: function () {
            var d = { label: '', date: '', times: [], _off: [], _named: true }; settle(d); days.push(d); paint();
            var el = resultBox.querySelector('[name="day-name-' + (days.length - 1) + '"]'); if (el && el.focus) el.focus();
          } }, 'Add a day that has no date yet')),
        h('section', { class: 'tt-card' },
          h('div', { class: 'tt-step-head' }, h('span', { class: 'tt-num' }, '2'), h('div', null, h('h3', null, 'Hours'), h('p', { class: 'help' }, 'Every day uses these hours. One day can have its own.'))),
          h('div', { class: 'tt-hours' }, time('start', 'First slot starts'), time('end', 'Last slot ends by'),
            num('length', 'One slot is', 'min', 5, 240), num('gap', 'Break after it', 'min', 0, 120)),
          hoursNote,
          h('div', { class: 'tt-capacity' }, h('div', null, h('span', { class: 'label' }, 'Bookings per slot'), h('p', { class: 'help' }, 'How many teams can book the same time.')),
            h('div', { class: 'stepper' },
              h('button', { type: 'button', class: 'icon-btn sm', name: 'capacity-down', 'aria-label': 'Fewer bookings per slot', onclick: function () { step(-1); } }, '−'),
              capVal,
              h('button', { type: 'button', class: 'icon-btn sm', name: 'capacity-up', 'aria-label': 'More bookings per slot', onclick: function () { step(1); } }, '+'))))),
      h('div', { class: 'l-main' }, resultBox));
    sortDays();
    paint();

    return {
      node: node,
      summary: function () {
        var slots = days.reduce(function (n, d) { return n + d.times.length; }, 0);
        return days.length ? plural(days.length, 'day', 'days') + ' · ' + plural(slots, 'slot', 'slots') + ' · ' + plural(f.slots.capacity || 1, 'booking', 'bookings') + ' per slot' : 'No days yet';
      },
      /** The first thing that stops a save, or ''. */
      problem: function () {
        if (days.some(function (d) { return !String(d.label || '').trim(); })) return 'Give every day a date or a name.';
        var empty = days.filter(function (d) { return !d.times.length; })[0];
        return empty ? '"' + empty.label + '" has no time slots.' : '';
      },
      /** The timetable as the server stores it. */
      slots: function () {
        return { capacity: f.slots.capacity || 1, pattern: { start: pat.start, end: pat.end, length: pat.length, gap: pat.gap },
          days: days.map(function (d) { return { id: d.id, label: d.label, date: d.date, times: d.times.slice() }; }) };
      }
    };
  };
})(window.App = window.App || {});

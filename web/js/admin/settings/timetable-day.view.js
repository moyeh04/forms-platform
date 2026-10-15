/**
 * One day of the timetable as a row of the result: its name, its slots as
 * chips that switch a time on or off, its own hours, and its tools. The
 * parts of a row share `r`: `{t, d, i}`, the timetable, the day and its
 * place in the list.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var TT = A.tt;
  var h = App.ui.h;
  var icon = App.ui.icon;

  /**
   * Puts the focus on the name input of a day, once it is drawn.
   *
   * @param {!Object} t The timetable.
   * @param {number} i The place of the day.
   */
  TT.focusName = function (t, i) {
    var el = t.resultBox.querySelector('[name="day-name-' + i + '"]');
    if (el?.focus) el.focus();
  };

  /**
   * Draws the name of a day: the label of a dated day with a Rename link,
   * or an input for a day being renamed or with no date.
   *
   * @param {!Object} r The row.
   * @return {!Element} The name.
   */
  function dayName(r) {
    var d = r.d;
    var name = h('div', { class: 'tt-row-name' });
    if (d.date && !d._rename) {
      name.appendChild(h('strong', null, d.label));
      name.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'link-btn',
            name: 'rename-day-' + r.i,
            onclick: function () {
              d._rename = true;
              r.t.paintResult();
              TT.focusName(r.t, r.i);
            }
          },
          'Rename'
        )
      );
      return name;
    }
    name.appendChild(
      h('input', {
        class: 'input',
        type: 'text',
        name: 'day-name-' + r.i,
        value: d.label,
        placeholder: 'Name of this day, for example Week 11 - Sunday',
        'aria-label': 'Name of day ' + (r.i + 1),
        oninput: function (e) {
          d.label = e.target.value;
          d._named = true;
        }
      })
    );
    return name;
  }

  /**
   * Draws a time of a day as a chip that switches it on or off.
   *
   * @param {!Object} r The row.
   * @param {string} tm The time.
   * @param {number} k Its place among the times of the day.
   * @return {!Element} The chip.
   */
  function slotChip(r, tm, k) {
    var d = r.d;
    var on = d.times.indexOf(tm) !== -1;
    var n = TT.booked(r.t, d, tm);
    var title =
      (on ? 'Click to switch this time off' : 'Click to switch this time on') +
      (n ? '. ' + A.plural(n, 'team has', 'teams have') + ' booked it.' : '');
    return h(
      'button',
      {
        type: 'button',
        class: 'tt-slot' + (n ? ' booked' : ''),
        name: 'slot-' + r.i + '-' + k,
        'aria-pressed': on ? 'true' : 'false',
        title: title,
        onclick: function () {
          if (on) d._off.push(tm);
          else {
            d._off = d._off.filter(function (x) {
              return x !== tm;
            });
          }
          TT.settle(r.t, d);
          r.t.paintResult();
        }
      },
      tm,
      n ? h('span', { class: 'tt-slot-n' }, String(n)) : null
    );
  }

  /**
   * Draws one time of the day's own hours.
   *
   * @param {!Object} r The row.
   * @param {string} key 'start' or 'end'.
   * @param {string} label The label.
   * @return {!Element} The field.
   */
  function ownTime(r, key, label) {
    return A.field(
      label,
      h('input', {
        class: 'input',
        type: 'time',
        name: 'day-' + key + '-' + r.i,
        value: r.d._own[key],
        oninput: function (e) {
          if (!e.target.value) return;
          r.d._own[key] = e.target.value;
          TT.reset(r.t, r.d);
          r.t.paintResult();
        }
      })
    );
  }

  /**
   * Draws the day's own hours and the link back to the general hours.
   *
   * @param {!Object} r The row.
   * @return {!Element} The hours.
   */
  function ownHours(r) {
    return h(
      'div',
      { class: 'tt-own' },
      ownTime(r, 'start', 'This day starts'),
      ownTime(r, 'end', 'and ends by'),
      h(
        'button',
        {
          type: 'button',
          class: 'link-btn',
          name: 'general-hours-' + r.i,
          onclick: function () {
            delete r.d._own;
            TT.reset(r.t, r.d);
            r.t.paintResult();
          }
        },
        'Use the general hours'
      )
    );
  }

  /**
   * Draws the link that gives a day its own hours. Asking for own hours
   * also replaces times that no hours explain.
   *
   * @param {!Object} r The row.
   * @return {!Element} The link.
   */
  function ownHoursButton(r) {
    var d = r.d;
    return h(
      'button',
      {
        type: 'button',
        class: 'link-btn',
        name: 'own-hours-' + r.i,
        onclick: function () {
          delete d._kept;
          d._own = { start: r.t.pat.start, end: r.t.pat.end };
          TT.reset(r.t, d);
          r.t.paintResult();
        }
      },
      d._kept ? 'Set hours for this day' : 'Different hours'
    );
  }

  /**
   * Draws the tools of a day: own hours, when it has none yet, and remove.
   *
   * @param {!Object} r The row.
   * @return {!Element} The tools.
   */
  function dayTools(r) {
    return h(
      'span',
      { class: 'tt-row-tools' },
      r.d._own ? null : ownHoursButton(r),
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn sm',
          name: 'remove-day-' + r.i,
          'aria-label': 'Remove ' + (r.d.label || 'this day'),
          onclick: function () {
            r.t.days.splice(r.i, 1);
            r.t.paint();
          }
        },
        icon('trash', A.ICON_SIZE.MENU)
      )
    );
  }

  /**
   * Draws a day of the result.
   *
   * @param {!Object} t The timetable.
   * @param {!Object} d The day.
   * @param {number} i Its place in the list.
   * @return {!Element} The row.
   */
  TT.dayRow = function (t, d, i) {
    var r = { t: t, d: d, i: i };
    var times = TT.offered(t, d);
    var count = TT.bookedOn(t, d);
    var slots = times.length
      ? h(
          'div',
          { class: 'tt-slots' },
          times.map(function (tm, k) {
            return slotChip(r, tm, k);
          })
        )
      : h(
          'p',
          { class: 'error' },
          'These hours leave no room for a slot. Make the day longer or the' +
            ' slot shorter.'
        );
    return h(
      'div',
      {
        class: 'tt-row' + (d.times.length ? '' : ' bad'),
        dataset: { day: d.date || d.label }
      },
      h(
        'div',
        { class: 'tt-row-head' },
        dayName(r),
        h(
          'span',
          { class: 'muted-note' },
          A.plural(d.times.length, 'slot', 'slots') +
            (count ? ' · ' + count + ' booked' : '')
        ),
        dayTools(r)
      ),
      d._own ? ownHours(r) : null,
      slots
    );
  };
})(window.App);

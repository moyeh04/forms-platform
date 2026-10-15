/**
 * The hours of the timetable: one set that every day follows, the note of
 * the slots they give, and how many teams can book the same slot.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var TT = A.tt;
  var h = App.ui.h;
  var Rules = window.Rules;

  /** The bounds of the length of a slot and of the break after it. */
  var MINUTES = {
    LENGTH: { MIN: 5, MAX: 240 },
    GAP: { MIN: 0, MAX: 120 }
  };

  /**
   * Takes in new general hours. They give new slots, so a slot switched
   * off under the old hours has no meaning now.
   *
   * @param {!Object} t The timetable.
   */
  function hoursChanged(t) {
    t.days.forEach(function (d) {
      if (!d._kept) TT.reset(t, d);
    });
    t.paint();
  }

  /**
   * Draws a number of minutes of the general hours. A value outside the
   * bounds is not taken.
   *
   * @param {!Object} t The timetable.
   * @param {string} key 'length' or 'gap'.
   * @param {string} label The label.
   * @return {!Element} The field.
   */
  function minutesField(t, key, label) {
    var limit = MINUTES[key.toUpperCase()];
    var input = h('input', {
      class: 'input',
      type: 'number',
      inputmode: 'numeric',
      min: String(limit.MIN),
      max: String(limit.MAX),
      name: 'hours-' + key,
      value: String(t.pat[key]),
      oninput: function (e) {
        var v = parseInt(e.target.value, 10);
        if (Number.isNaN(v) || v < limit.MIN || v > limit.MAX) return;
        t.pat[key] = v;
        hoursChanged(t);
      }
    });
    return h(
      'label',
      { class: 'field-row' },
      h('span', { class: 'label' }, label),
      h('span', { class: 'tt-unit' }, input, 'min')
    );
  }

  /**
   * Draws a time of the general hours. An empty time is not taken.
   *
   * @param {!Object} t The timetable.
   * @param {string} key 'start' or 'end'.
   * @param {string} label The label.
   * @return {!Element} The field.
   */
  function timeField(t, key, label) {
    return A.field(
      label,
      h('input', {
        class: 'input',
        type: 'time',
        name: 'hours-' + key,
        value: t.pat[key],
        oninput: function (e) {
          if (!e.target.value) return;
          t.pat[key] = e.target.value;
          hoursChanged(t);
        }
      })
    );
  }

  /**
   * Draws the note of the slots the general hours give.
   *
   * @param {!Object} t The timetable: `pat` and `hoursNote`.
   */
  TT.paintHours = function (t) {
    var all = Rules.generateSlots(t.pat);
    var note = t.hoursNote;
    note.textContent = all.length
      ? A.plural(all.length, 'slot', 'slots') +
        ' a day: ' +
        all[0] +
        (all.length > 1 ? ' to ' + all[all.length - 1] : '')
      : 'These hours leave no room for a slot.';
    note.classList.toggle('error', !all.length);
  };

  /**
   * Draws a button of the bookings per slot.
   *
   * @param {!Object} t The timetable.
   * @param {!Element} value Shows the bookings per slot.
   * @param {number} by -1 for fewer, 1 for more.
   * @return {!Element} The button.
   */
  function stepButton(t, value, by) {
    var down = by < 0;
    return h(
      'button',
      {
        type: 'button',
        class: 'icon-btn sm',
        name: down ? 'capacity-down' : 'capacity-up',
        'aria-label': down
          ? 'Fewer bookings per slot'
          : 'More bookings per slot',
        onclick: function () {
          var c = TT.CAPACITY;
          t.f.slots.capacity = Math.max(
            c.MIN,
            Math.min(c.MAX, TT.capacity(t) + by)
          );
          value.textContent = String(t.f.slots.capacity);
          t.paintResult();
        }
      },
      down ? '−' : '+'
    );
  }

  /**
   * Draws how many teams can book the same time.
   *
   * @param {!Object} t The timetable.
   * @return {!Element} The stepper with its label.
   */
  function capacityField(t) {
    var value = h(
      'output',
      { class: 'stepper-val', name: 'capacity' },
      String(TT.capacity(t))
    );
    return h(
      'div',
      { class: 'tt-capacity' },
      h(
        'div',
        null,
        h('span', { class: 'label' }, 'Bookings per slot'),
        h('p', { class: 'help' }, 'How many teams can book the same time.')
      ),
      h(
        'div',
        { class: 'stepper' },
        stepButton(t, value, -1),
        value,
        stepButton(t, value, 1)
      )
    );
  }

  /**
   * Draws the head of a numbered card of the setup.
   *
   * @param {string} num Its number.
   * @param {string} title Its title.
   * @param {string} help What it does.
   * @return {!Element} The head.
   */
  TT.stepHead = function (num, title, help) {
    return h(
      'div',
      { class: 'tt-step-head' },
      h('span', { class: 'tt-num' }, num),
      h('div', null, h('h3', null, title), h('p', { class: 'help' }, help))
    );
  };

  /**
   * Draws the card of the hours.
   *
   * @param {!Object} t The timetable.
   * @return {!Element} The card.
   */
  TT.hoursCard = function (t) {
    return h(
      'section',
      { class: 'tt-card' },
      TT.stepHead(
        '2',
        'Hours',
        'Every day uses these hours. One day can have its own.'
      ),
      h(
        'div',
        { class: 'tt-hours' },
        timeField(t, 'start', 'First slot starts'),
        timeField(t, 'end', 'Last slot ends by'),
        minutesField(t, 'length', 'One slot is'),
        minutesField(t, 'gap', 'Break after it')
      ),
      t.hoursNote,
      capacityField(t)
    );
  };
})(window.App);

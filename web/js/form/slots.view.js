/**
 * The slots of a reservation: the days, the times with the places left in each,
 * and the text of a booked slot.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  /** The size of the icon before the note about moving, in pixels. */
  var NOTE_ICON_SIZE = 18;

  /**
   * Counts the bookings of everyone else in each slot: the student's own
   * booking does not take a place from itself.
   *
   * @return {!Object<string, number>} The bookings, by slot key.
   */
  function othersIn() {
    var counts = Object.assign({}, S.taken);
    if (S.ownSlot && counts[S.ownSlot]) counts[S.ownSlot] -= 1;
    return counts;
  }

  /**
   * Counts the places left in a slot.
   *
   * @param {string} dayId The day.
   * @param {string} time The time.
   * @return {number} The places left.
   */
  function roomIn(dayId, time) {
    return Rules.slotRoom(S.form, othersIn(), Rules.slotKey(dayId, time));
  }

  /**
   * Counts the places a day still has, so a student sees a full day before
   * choosing it.
   *
   * @param {!Object} d The day.
   * @return {number} The places left.
   */
  function dayRoom(d) {
    return d.times.reduce(function (n, tm) {
      return n + roomIn(d.id, tm);
    }, 0);
  }

  /**
   * Makes the chip of a day, with the places it has left.
   *
   * @param {!Object} d The day.
   * @param {!Object} cur The slot picked now.
   * @param {function(!Object)} choose Keeps a picked slot.
   * @return {!Element} The chip.
   */
  function dayChip(d, cur, choose) {
    var left = dayRoom(d);
    return h(
      'button',
      {
        type: 'button',
        class: 'slot-chip' + (left ? '' : ' is-full'),
        disabled: !left,
        'aria-pressed': cur.day === d.id ? 'true' : 'false',
        onclick: function () {
          choose({ day: d.id, time: '' });
        }
      },
      d.label,
      d.date ? h('small', null, d.date) : null,
      h(
        'small',
        { class: 'slot-left' },
        left ? t('slotsLeft', { n: left }) : t('slotFull')
      )
    );
  }

  /**
   * Writes the line under a time: full, or the places left when a slot
   * holds more than one team.
   *
   * @param {boolean} taken True when it is full.
   * @param {boolean} many True when a slot holds more than one team.
   * @param {number} room The places left.
   * @return {?Element} The line, or null.
   */
  function timeNote(taken, many, room) {
    if (taken) return h('small', { class: 'slot-left' }, t('slotFull'));
    if (!many) return null;
    return h('small', { class: 'slot-left' }, t('slotsLeft', { n: room }));
  }

  /**
   * Makes the chip of a time. The time the student holds stays open even
   * when it is full.
   *
   * @param {!Object} day The day.
   * @param {string} tm The time.
   * @param {!Object} cur The slot picked now.
   * @param {function(!Object)} choose Keeps a picked slot.
   * @return {!Element} The chip.
   */
  function timeChip(day, tm, cur, choose) {
    var room = roomIn(day.id, tm);
    var taken = !room && cur.time !== tm;
    var slots = S.form.slots || {};
    return h(
      'button',
      {
        type: 'button',
        class: 'slot-chip time' + (taken ? ' is-full' : ''),
        disabled: taken,
        'aria-pressed': cur.time === tm ? 'true' : 'false',
        onclick: function () {
          choose({ day: day.id, time: tm });
        }
      },
      h('span', { dir: 'ltr' }, tm),
      timeNote(taken, (slots.capacity || 1) > 1, room)
    );
  }

  /**
   * Draws the times of the picked day.
   *
   * @param {?Object} day The day, or null when none is picked.
   * @param {!Object} cur The slot picked now.
   * @param {function(!Object)} choose Keeps a picked slot.
   * @return {!Element} The times, or a line that says why there are none.
   */
  function timesOf(day, cur, choose) {
    if (!day) return h('p', { class: 'help' }, t('slotPick'));
    var open = day.times.filter(function (tm) {
      return roomIn(day.id, tm) || cur.time === tm;
    });
    if (!open.length) return h('p', { class: 'help' }, t('slotNone'));
    return h(
      'div',
      { class: 'slot-times', role: 'group', 'aria-label': t('slotTime') },
      day.times.map(function (tm) {
        return timeChip(day, tm, cur, choose);
      })
    );
  }

  /**
   * Draws the note that moving a booking gives up the time it had, so the
   * student is told before saving that anyone can then take it.
   *
   * @param {!Object} cur The slot picked now.
   * @return {?Element} The note, or null.
   */
  function moveNote(cur) {
    var picked = cur.day && cur.time ? Rules.slotKey(cur.day, cur.time) : '';
    if (S.mode !== 'edit' || !S.ownSlot || !picked || picked === S.ownSlot) {
      return null;
    }
    return h(
      'p',
      { class: 'slot-move', role: 'status', name: 'slot-move' },
      App.ui.icon('info', NOTE_ICON_SIZE),
      h('span', null, t('slotMove', { was: slotText(S.ownSlot) }))
    );
  }

  /**
   * Draws the days and the times of the picked day into the slot box.
   *
   * @param {!Element} wrap The box.
   * @param {string} path The path of the answer.
   */
  function paintSlots(wrap, path) {
    var slots = S.form.slots || {};
    var days = slots.days || [];
    var cur = P.getVal(path) || {};

    /**
     * Keeps a picked slot and draws the box again.
     *
     * @param {!Object} value The slot, as `{day, time}`.
     */
    function choose(value) {
      P.setVal(path, value);
      delete S.errors[path];
      P.paintError(path);
      P.saveDraft();
      paintSlots(wrap, path);
    }

    var day = days.filter(function (d) {
      return d.id === cur.day;
    })[0];
    App.ui.clear(wrap);
    wrap.append(
      h(
        'div',
        { class: 'slot-days', role: 'group', 'aria-label': t('slotDay') },
        days.map(function (d) {
          return dayChip(d, cur, choose);
        })
      ),
      timesOf(day, cur, choose)
    );
    var note = day ? moveNote(cur) : null;
    if (note) wrap.appendChild(note);
  }

  /**
   * Draws the slot question of a reservation.
   *
   * @param {!Object} _field The question; its days are the form's slots.
   * @param {string} path The path of its answer.
   * @param {string} id The id of the box.
   * @return {!Element} The box.
   */
  function slotControl(_field, path, id) {
    var wrap = h('div', { class: 'slot', id: id });
    paintSlots(wrap, path);
    return wrap;
  }

  /**
   * Wraps text that keeps its left-to-right order inside an Arabic
   * sentence, such as a day and a time.
   *
   * @param {string} text The text.
   * @return {string} The text between isolate marks.
   */
  function ltr(text) {
    return '\u2066' + text + '\u2069';
  }

  /**
   * Writes a slot key as the review does, such as "Sunday 14 Nov - 12:30 -
   * 12:50".
   *
   * @param {string} key The slot key, as `day|time`.
   * @return {*} The text.
   */
  function slotText(key) {
    var parts = String(key).split('|');
    return P.displayValue(P.slotField(), {
      day: parts[0],
      time: parts.slice(1).join('|')
    });
  }

  P.slotControl = slotControl;
  P.ltr = ltr;
})(window.App);

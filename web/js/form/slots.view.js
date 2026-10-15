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

  /** Bookings of everyone else in each slot: the student's own booking does not take a place from itself. */
  function othersIn() {
    var counts = Object.assign({}, S.taken);
    if (S.ownSlot && counts[S.ownSlot]) counts[S.ownSlot] -= 1;
    return counts;
  }

  function roomIn(dayId, time) {
    return Rules.slotRoom(S.form, othersIn(), Rules.slotKey(dayId, time));
  }

  function slotsTaken(dayId, time) {
    return !roomIn(dayId, time);
  }

  function slotControl(field, path, id) {
    var wrap = h('div', { class: 'slot', id: id });
    function paint() {
      App.ui.clear(wrap);
      var days = (S.form.slots && S.form.slots.days) || [];
      var many = ((S.form.slots && S.form.slots.capacity) || 1) > 1;
      var cur = P.getVal(path) || {};
      // Each day says how many places it still has, so a student sees a full day before choosing it.
      var dayChips = days.map(function (d) {
        var left = d.times.reduce(function (n, tm) {
          return n + roomIn(d.id, tm);
        }, 0);
        return h(
          'button',
          {
            type: 'button',
            class: 'slot-chip' + (left ? '' : ' is-full'),
            disabled: !left,
            'aria-pressed': cur.day === d.id ? 'true' : 'false',
            onclick: function () {
              P.setVal(path, { day: d.id, time: '' });
              delete S.errors[path];
              P.paintError(path);
              P.saveDraft();
              paint();
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
      });
      wrap.appendChild(
        h(
          'div',
          { class: 'slot-days', role: 'group', 'aria-label': t('slotDay') },
          dayChips
        )
      );
      var day = days.filter(function (d) {
        return d.id === cur.day;
      })[0];
      if (!day) {
        wrap.appendChild(h('p', { class: 'help' }, t('slotPick')));
        return;
      }
      var open = day.times.filter(function (tm) {
        return !slotsTaken(day.id, tm) || cur.time === tm;
      });
      if (!open.length) {
        wrap.appendChild(h('p', { class: 'help' }, t('slotNone')));
        return;
      }
      wrap.appendChild(
        h(
          'div',
          { class: 'slot-times', role: 'group', 'aria-label': t('slotTime') },
          day.times.map(function (tm) {
            var room = roomIn(day.id, tm);
            var taken = !room && cur.time !== tm;
            return h(
              'button',
              {
                type: 'button',
                class: 'slot-chip time' + (taken ? ' is-full' : ''),
                disabled: taken,
                'aria-pressed': cur.time === tm ? 'true' : 'false',
                onclick: function () {
                  P.setVal(path, { day: day.id, time: tm });
                  delete S.errors[path];
                  P.paintError(path);
                  P.saveDraft();
                  paint();
                }
              },
              h('span', { dir: 'ltr' }, tm),
              taken
                ? h('small', { class: 'slot-left' }, t('slotFull'))
                : many
                  ? h(
                      'small',
                      { class: 'slot-left' },
                      t('slotsLeft', { n: room })
                    )
                  : null
            );
          })
        )
      );
      // Moving a booking gives up the time it had; the student is told before saving that anyone can then take it.
      var picked = cur.day && cur.time ? Rules.slotKey(cur.day, cur.time) : '';
      if (S.mode === 'edit' && S.ownSlot && picked && picked !== S.ownSlot) {
        wrap.appendChild(
          h(
            'p',
            { class: 'slot-move', role: 'status', name: 'slot-move' },
            App.ui.icon('info', 18),
            h('span', null, t('slotMove', { was: slotText(S.ownSlot) }))
          )
        );
      }
    }
    paint();
    return wrap;
  }

  /** Text that keeps its left-to-right order inside an Arabic sentence, such as a day and a time. */
  function ltr(text) {
    return '\u2066' + text + '\u2069';
  }

  /** "Sunday 14 Nov - 12:30 - 12:50" for a slot key. */
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

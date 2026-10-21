const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const { boot, openAdmin, person } = require('../harness/admin-page.js');

/**
 * Moves the timetable calendar to a month, written as it is shown: "March
 * 2028".
 */
function showMonth(p, month) {
  for (let i = 0; i < 240 && p.$('.tt-cal-month').textContent !== month; i++)
    p.click('[name="cal-next"]');
  assert.equal(p.$('.tt-cal-month').textContent, month);
}

const slotTexts = (p, row) =>
  [...p.$$('.tt-row')[row].querySelectorAll('.tt-slot')].map(
    (c) => c.firstChild.textContent
  );

test(
  'Timetable: a day needs a name, gets the general hours, ' +
    'and bookings appear grouped by day',
  async () => {
    const w = boot();
    const f = w.make('reservation', 'Seminar');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.ok(p.text().includes('No days yet.'));
    showMonth(p, 'March 2028');
    p.click('[name="cal-2028-03-12"]');
    p.click('[name="rename-day-0"]');
    p.type('[name="day-name-0"]', ' ');
    p.click('[name="save"]');
    await settle(8);
    assert.ok(
      p.text().includes('Give every day a name.'),
      'a day without a name is refused'
    );
    p.type('[name="day-name-0"]', 'Week 11 - Sunday');
    assert.deepEqual(
      slotTexts(p, 0).slice(0, 2),
      ['12:30 - 12:50', '12:55 - 1:15'],
      'a new day starts with the general hours'
    );
    p.click('[name="save"]');
    await settle(12);
    const days = w.admin({ action: 'admin.forms.get', id: f.id }).form.slots
      .days;
    assert.equal(days[0].id, 'week-11-sunday');
    assert.equal(days[0].times.length, 7);

    w.api({
      action: 'submit',
      slug: f.slug,
      data: person({
        title: 'Library',
        slot: { day: 'week-11-sunday', time: '12:55 - 1:15' }
      })
    });
    const q = await openAdmin(w, `#/f/${f.slug}`);
    const day = q.$('.block.single[data-day="week-11-sunday"]');
    assert.ok(day.textContent.includes('1 booked'));
    assert.ok(
      day.querySelector('tbody td.mono').textContent.includes('12:55 - 1:15')
    );
  }
);

test(
  'Timetable: dates picked on the calendar become days that follow the ' +
    'hours',
  async () => {
    const w = boot();
    const f = w.make('reservation', 'Seminar');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    p.type('[name="hours-start"]', '10:00');
    p.type('[name="hours-end"]', '11:00');
    p.type('[name="hours-length"]', '15');
    p.type('[name="hours-gap"]', '0');
    assert.ok(
      p.text().includes('4 slots a day: 10:00 - 10:15 to 10:45 - 11:00'),
      'the hours say what they give'
    );
    showMonth(p, 'March 2028');
    p.click('[name="cal-2028-03-19"]');
    p.click('[name="cal-2028-03-12"]');
    p.click('[name="cal-2028-03-14"]');
    assert.equal(
      p.$('[name="cal-2028-03-12"]').getAttribute('aria-pressed'),
      'true'
    );
    assert.deepEqual(
      p.$$('.tt-row').map((r) => r.dataset.day),
      ['2028-03-12', '2028-03-14', '2028-03-19'],
      'days are kept in date order'
    );
    assert.ok(p.text().includes('3 days · 12 slots · 12 bookings at most'));
    p.click('[name="cal-2028-03-14"]');
    assert.equal(
      p.$('[name="cal-2028-03-14"]').getAttribute('aria-pressed'),
      'false',
      'a second click removes the day'
    );
    assert.equal(p.$$('.tt-row').length, 2);

    p.click('[name="slot-0-3"]');
    assert.equal(
      p.$('[name="slot-0-3"]').getAttribute('aria-pressed'),
      'false'
    );
    assert.ok(p.$$('.tt-row')[0].textContent.includes('3 slots'));
    p.click('[name="capacity-up"]');
    assert.ok(p.text().includes('2 days · 7 slots · 14 bookings at most'));
    p.click('[name="save"]');
    await settle(12);
    const slots = w.admin({ action: 'admin.forms.get', id: f.id }).form.slots;
    assert.equal(slots.capacity, 2);
    assert.deepEqual(slots.pattern, {
      start: '10:00',
      end: '11:00',
      length: 15,
      gap: 0
    });
    assert.deepEqual(
      slots.days.map((d) => [d.date, d.label]),
      [
        ['2028-03-12', 'Sunday 12 Mar'],
        ['2028-03-19', 'Sunday 19 Mar']
      ]
    );
    assert.deepEqual(slots.days[0].times, [
      '10:00 - 10:15',
      '10:15 - 10:30',
      '10:30 - 10:45'
    ]);
    assert.equal(slots.days[1].times.length, 4);

    const q = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(
      q.$('.tt-cal-month').textContent,
      'March 2028',
      'the calendar opens on the month of the saved days'
    );
    assert.equal(
      q.$('[name="slot-0-3"]').getAttribute('aria-pressed'),
      'false',
      'a slot switched off is still shown, switched off'
    );
    q.click('[name="slot-0-3"]');
    assert.equal(q.$('[name="slot-0-3"]').getAttribute('aria-pressed'), 'true');
  }
);

test(
  'Timetable: one day can have its own hours, go back to the general ' +
    'ones, and take another name',
  async () => {
    const w = boot();
    const f = w.make('reservation', 'Seminar');
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    showMonth(p, 'March 2028');
    p.click('[name="cal-2028-03-12"]');
    p.click('[name="cal-2028-03-14"]');
    assert.equal(
      p.$('[name="day-start-1"]'),
      null,
      'own hours stay closed until asked for'
    );
    p.click('[name="own-hours-1"]');
    assert.equal(
      p.$('[name="day-start-1"]').value,
      '12:30',
      'own hours start from the general ones'
    );
    assert.equal(p.$('[name="own-hours-1"]'), null);
    p.type('[name="day-end-1"]', '13:20');
    assert.deepEqual(slotTexts(p, 1), ['12:30 - 12:50', '12:55 - 1:15']);
    assert.equal(slotTexts(p, 0).length, 7, 'the other day is untouched');
    p.type('[name="hours-end"]', '14:10');
    assert.equal(
      slotTexts(p, 0).length,
      4,
      'the general hours move the days that follow them'
    );
    assert.equal(
      slotTexts(p, 1).length,
      2,
      'and leave a day with its own hours alone'
    );

    p.type('[name="day-end-1"]', '12:35');
    assert.ok(
      p
        .$$('.tt-row')[1]
        .textContent.includes('These hours leave no room for a slot')
    );
    p.click('[name="save"]');
    await settle(8);
    assert.ok(p.text().includes('"Tuesday 14 Mar" has no time slots.'));
    p.click('[name="general-hours-1"]');
    assert.equal(slotTexts(p, 1).length, 4);

    p.click('[name="rename-day-0"]');
    p.type('[name="day-name-0"]', 'Week 11 - Sunday');
    p.click('[name="remove-day-1"]');
    assert.equal(
      p.$('[name="cal-2028-03-14"]').getAttribute('aria-pressed'),
      'false',
      'the calendar follows a day removed from the list'
    );
    p.click('[name="save"]');
    await settle(12);
    const days = w.admin({ action: 'admin.forms.get', id: f.id }).form.slots
      .days;
    assert.deepEqual(
      days.map((d) => [d.label, d.date, d.times.length]),
      [['Week 11 - Sunday', '2028-03-12', 4]]
    );
  }
);

test(
  'Timetable: a booked slot shows its count, and switching it off ' +
    'warns before saving',
  async () => {
    const w = boot();
    const f = w.make('reservation', 'Seminar');
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: {
        status: 'open',
        slots: {
          days: [
            {
              id: 'one',
              label: 'Sunday',
              date: '2027-11-14',
              times: ['12:30 - 12:50', '12:55 - 1:15']
            }
          ],
          capacity: 1
        }
      }
    });
    const form = w.api({ action: 'getForm', slug: f.slug }).form;
    const data = {
      email: 'a@example.com',
      leader_name: 'أحمد محمد محمود علي',
      leader_code: '4230459',
      phone: '01012345678',
      title: 'Library',
      slot: { day: 'one', time: '12:55 - 1:15' }
    };
    for (const field of form.fields)
      if (field.type === 'select' && field.enabled !== false)
        data[field.id] = String(field.options[0].value);
    assert.equal(w.api({ action: 'submit', slug: f.slug, data }).ok, true);
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.equal(
      p.$$('.tt-slot').length,
      7,
      'times that are off are offered next to the two that are on'
    );
    assert.equal(p.$$('.tt-slot[aria-pressed="true"]').length, 2);
    const slot = () => p.$('.tt-slot.booked');
    assert.equal(slot().querySelector('.tt-slot-n').textContent, '1');
    assert.ok(p.$('.tt-row').textContent.includes('1 booked'));
    assert.equal(p.$('[name="orphans"]'), null);
    p.click('.tt-slot.booked');
    assert.equal(slot().getAttribute('aria-pressed'), 'false');
    assert.ok(
      p
        .$('[name="orphans"]')
        .textContent.includes(
          '1 booking is on a day or a time that is no longer here'
        )
    );
    p.click('.tt-slot.booked');
    assert.equal(
      p.$('[name="orphans"]'),
      null,
      'putting the slot back clears the warning'
    );
  }
);

test(
  'Timetable: times saved by hand are kept as they are until the day ' +
    'gets hours',
  async () => {
    const w = boot();
    const f = w.make('reservation', 'Seminar');
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: {
        slots: {
          days: [
            {
              id: 'one',
              label: 'Sunday',
              date: '2027-11-16',
              times: ['9:00 - 9:30', '11:30 - 11:45']
            }
          ],
          capacity: 1
        }
      }
    });
    const p = await openAdmin(w, `#/f/${f.slug}/settings`);
    assert.deepEqual(slotTexts(p, 0), ['9:00 - 9:30', '11:30 - 11:45']);
    p.type('[name="hours-end"]', '14:10');
    assert.deepEqual(
      slotTexts(p, 0),
      ['9:00 - 9:30', '11:30 - 11:45'],
      'the general hours do not replace them'
    );
    assert.equal(
      p.$('[name="own-hours-0"]').textContent,
      'Set hours for this day'
    );
    p.click('[name="own-hours-0"]');
    assert.equal(slotTexts(p, 0).length, 4);
  }
);

const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const {
  boot,
  open,
  AR_NAME,
  fillAbout,
  fillStudy
} = require('../harness/form-page.js');

/**
 * Opens a reservation at its time slot step.
 *
 * @param {!Object} w The world.
 * @return {!Promise<!Object>} The page.
 */
async function atSlots(w) {
  const p = await open(w);
  await fillAbout(p, '4230002');
  p.submitForm();
  await settle();
  await fillStudy(p);
  p.submitForm();
  await settle();
  p.type('[name="title"]', 'Project 1');
  p.submitForm();
  await settle();
  return p;
}

/**
 * Finds the button of a booking day by its label.
 *
 * @param {!Object} p The page.
 * @param {string} label The label.
 * @return {?Element} The button.
 */
function dayButton(p, label) {
  return p.$$('.cal-date.is-day').find((b) => b.title === label) || null;
}

test('Slot calendar: a date is picked first, then a time', async () => {
  const w = boot('reservation', {
    slots: {
      days: [
        { label: 'Day 1', date: '2027-11-14', times: ['10:00 - 10:20'] },
        { label: 'Day 2', date: '2027-12-05', times: ['11:00 - 11:20'] }
      ],
      capacity: 1
    }
  });
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: {
      email: 'a@b.com',
      leader_name: AR_NAME,
      leader_code: '4230001',
      phone: '01012345678',
      major: 'حاسبات',
      level: 'صفر / الأولى',
      section: '4C-TH1',
      curriculum: '2020',
      title: 'Taken',
      slot: { day: 'day-1', time: '10:00 - 10:20' }
    }
  });
  const p = await atSlots(w);
  assert.equal(p.$$('.cal-wd').length, 7, 'a week has seven columns');
  assert.equal(p.$$('.slot-chip.time').length, 0, 'no times before a day');
  assert.ok(
    p.$('.cal-month').textContent.includes('December'),
    'it opens on the first month with a free day'
  );
  p.click(p.$('[name="month-prev"]'));
  await settle();
  assert.ok(p.$('.cal-month').textContent.includes('November'));
  assert.equal(dayButton(p, 'Day 1').disabled, true, 'a full day is shut');
  assert.equal(p.$$('.cal-grid .cal-date').length, 30);
  p.click(p.$('[name="month-next"]'));
  await settle();
  p.click(dayButton(p, 'Day 2'));
  await settle();
  assert.equal(dayButton(p, 'Day 2').getAttribute('aria-pressed'), 'true');
  const times = p.$$('.slot-chip.time');
  assert.equal(times.length, 1);
  assert.ok(times[0].textContent.includes('11:00 - 11:20'));
});

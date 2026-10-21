const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const { boot, openAdmin } = require('../harness/admin-page.js');

test('Print: the day sheet prints the booking form it is on', async () => {
  const w = boot();
  const f = w.admin({
    action: 'admin.forms.create',
    type: 'reservation',
    title: 'Seminar',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: f.id,
    patch: {
      slots: {
        days: [
          { label: 'Sunday', date: '2027-11-14', times: ['12:30 - 12:50'] }
        ],
        capacity: 1
      }
    }
  });
  const p = await openAdmin(w, `#/f/${f.slug}`);
  p.click('[name="printDay"]');
  await settle(12);
  assert.ok(p.text().includes('Ready to print'), p.text().slice(-200));
  assert.ok(p.$('.dialog a[href*="#gid="]'), 'with a link to the print tab');
});

test('Print: the team list prints the team form it is on', async () => {
  const w = boot();
  const f = w.make('team_registration', 'Projects');
  const p = await openAdmin(w, `#/f/${f.slug}`);
  p.click('[name="printTeams"]');
  await settle(12);
  assert.ok(p.text().includes('Ready to print'), p.text().slice(-200));
});

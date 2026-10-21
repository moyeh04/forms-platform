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

test(
  'Reservation: optional teammates can be added, validated, and ' +
    'included on the ticket',
  async () => {
    const w = boot('reservation', {
      slots: {
        days: [
          {
            label: 'Week 11 - Sunday',
            date: '2027-11-14',
            times: ['12:30 - 12:50']
          }
        ],
        capacity: 1
      }
    });
    const f = w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
    w.admin({
      action: 'admin.forms.update',
      id: w.form.id,
      patch: {
        fields: f.fields.map((field) =>
          field.role === 'members'
            ? { ...field, enabled: true, required: true }
            : field
        ),
        steps: f.steps.map((step) =>
          step.id === 'project'
            ? { ...step, fields: step.fields.concat(['members']) }
            : step
        )
      }
    });
    const p = await open(w);
    await fillAbout(p);
    p.submitForm();
    await settle();
    await fillStudy(p);
    p.submitForm();
    await settle();
    p.type('[name="title"]', 'Library System');
    p.submitForm();
    await settle();
    p.clickText('Add a team member');
    await settle();
    p.type('[name="members.0.name"]', 'سارة خالد حسن علي');
    p.type('[name="members.0.phone"]', '01112345678');
    p.type('[name="members.0.code"]', '4230002');
    p.pick('members.0.level', 'صفر / الأولى');
    p.pick('members.0.curriculum', '2020');
    p.pick('members.0.section', '4C-TH1');
    p.submitForm();
    await settle();
    assert.equal(p.$('.step-title').textContent, 'Time slot');
    p.click(p.$('[name="day-week-11-sunday"]'));
    await settle();
    p.click(p.$('.slot-chip.time'));
    await settle();
    p.submitForm();
    await settle();
    assert.ok(p.text().includes('Check your details'));
    assert.ok(
      p.text().includes('سارة خالد حسن علي'),
      'the summary before booking lists the teammate'
    );
    p.submitForm();
    await settle(12);
    assert.ok(p.$('#ticket'));
    assert.ok(p.$('#ticket').textContent.includes('سارة خالد حسن علي'));
    const saved = w.admin({ action: 'admin.submissions', slug: w.form.slug })
      .submissions[0];
    assert.deepEqual(saved.data.members, [
      {
        name: 'سارة خالد حسن علي',
        phone: '01112345678',
        code: '4230002',
        level: 'صفر / الأولى',
        curriculum: '2020',
        section: '4C-TH1'
      }
    ]);
  }
);

test(
  'Reservation: taken slots are disabled ' + 'and a booking can be made',
  async () => {
    const w = boot('reservation', {
      slots: {
        days: [
          {
            label: 'Week 11 - Sunday',
            date: '2027-11-14',
            times: ['12:30 - 12:50', '12:55 - 1:15']
          }
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
        slot: { day: 'week-11-sunday', time: '12:30 - 12:50' }
      }
    });
    const p = await open(w);
    await fillAbout(p, '4230002');
    p.submitForm();
    await settle();
    await fillStudy(p);
    p.submitForm();
    await settle();
    p.type('[name="title"]', 'Library System');
    p.submitForm();
    await settle();
    assert.equal(p.$('.step-title').textContent, 'Time slot');
    assert.ok(p.text().includes('Pick a day'));
    assert.ok(
      p.$('.slot-days .cal-date.is-day').textContent.includes('1 left'),
      'a day says its places left before it is picked'
    );
    p.click(p.$('[name="day-week-11-sunday"]'));
    await settle();
    const chips = p.$$('.slot-chip.time');
    assert.equal(chips.length, 2);
    assert.equal(chips[0].disabled, true);
    assert.ok(
      chips[0].classList.contains('is-full') &&
        chips[0].textContent.includes('Fully booked')
    );
    assert.equal(chips[1].disabled, false);
    p.click(chips[1]);
    await settle();
    p.submitForm();
    await settle();
    p.submitForm();
    await settle(12);
    assert.ok(p.$('#ticket'));
    assert.ok(
      p.$('#ticket [name="when"]').textContent.includes('12:55 - 1:15'),
      'the time is drawn on a clock'
    );
    assert.ok(
      p.$('#ticket [name="when"]').textContent.includes('14'),
      'and the day on a calendar'
    );
    assert.deepEqual(
      [...p.$$('#ticket [name="when"] img')].map((i) => i.getAttribute('src')),
      ['assets/img/pirate.webp', 'assets/img/parrot.webp'],
      'with the pirate and the parrot'
    );
    assert.deepEqual(
      [...p.win.App.ticket.handAngles('12:55 - 1:15')],
      [27.5, 330],
      'the hands point at 12:55'
    );
    assert.deepEqual(
      [...p.win.App.ticket.slotArc('12:55 - 1:15')],
      [330, 450],
      'the slice runs from 55 past the minute round to 15'
    );
    assert.deepEqual(
      [...p.win.App.ticket.slotArc('10:00 - 11:30')],
      [300, 345],
      'a slot of more than an hour is marked on the hours'
    );
    assert.equal(
      p.$$('.key-digit').length,
      5,
      'a booking made by hand keeps its own key on the ticket'
    );
  }
);

test(
  'Reservation teammates: the note for a number of teammates shows ' +
    'once the leader has added that many',
  async () => {
    const w = boot('reservation', {
      slots: {
        days: [
          {
            label: 'Week 11 - Sunday',
            date: '2027-11-14',
            times: ['12:30 - 12:50']
          }
        ],
        capacity: 1
      }
    });
    const fields = w.admin({ action: 'admin.forms.get', id: w.form.id }).form
      .fields;
    Object.assign(
      fields.find((x) => x.role === 'members'),
      {
        enabled: true,
        required: false,
        min: 0,
        max: 2,
        notice: {
          sizes: [1, 7],
          text: { en: 'Other students may join you, up to {max}.', ar: '' }
        }
      }
    );
    w.admin({ action: 'admin.forms.update', id: w.form.id, patch: { fields } });
    const saved = w
      .api({ action: 'getForm', slug: w.form.slug })
      .form.fields.find((x) => x.role === 'members');
    assert.deepEqual(
      saved.notice.sizes,
      [1],
      'a number outside 0 to 2 is dropped'
    );
    const p = await open(w);
    await fillAbout(p, '4230002');
    p.submitForm();
    await settle();
    await fillStudy(p);
    p.submitForm();
    await settle();
    assert.equal(
      p.$('.members-wrap .size-notice'),
      null,
      'no note for a leader alone'
    );
    p.click('[name="add-member"]');
    await settle();
    assert.equal(
      p.$('.members-wrap .size-notice').textContent,
      'Other students may join you, up to 2.'
    );
    p.click('[name="add-member"]');
    await settle();
    assert.equal(p.$('.members-wrap .size-notice'), null, 'and none for two');
  }
);

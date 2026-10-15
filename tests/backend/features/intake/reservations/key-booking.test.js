const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

const slot = (i) => ({
  day: 'sunday',
  time: ['12:30 - 12:50', '12:55 - 1:15'][i]
});
const member = (name, code) => ({
  name,
  code,
  phone: '01112345678',
  level: 'الثاني / الثالثة',
  curriculum: '2020',
  section: '4C-TH2'
});

/**
 * A team form with two registered teams and a reservation that is booked with
 * their keys.
 */
function boot(patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.teams = w.admin({
    action: 'admin.forms.create',
    type: 'team_registration',
    title: 'Database Teams',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: w.teams.id,
    patch: { status: 'open' }
  });
  w.register = (code, extra = {}) =>
    w.api({
      action: 'submit',
      slug: w.teams.slug,
      data: {
        email: 'lead@example.com',
        leader_name: 'أحمد محمد محمود علي',
        leader_code: code,
        phone: '01012345678',
        major: 'حاسبات',
        level: 'الثاني / الثالثة',
        section: '4C-TH2',
        curriculum: '2020',
        team_size: '2',
        members: [member('سارة خالد حسن علي', String(Number(code) + 500))],
        title: 'Library System',
        ...extra
      }
    });
  w.keyA = w.register('4230001').key;
  w.keyB = w.register('4230002', { title: 'Clinic Booking' }).key;
  w.form = w.admin({
    action: 'admin.forms.create',
    type: 'reservation',
    title: 'Discussion',
    term: 'Fall 2027'
  }).form;
  w.update = (p) =>
    w.admin({ action: 'admin.forms.update', id: w.form.id, patch: p });
  w.update({
    status: 'open',
    slots: {
      days: [{ label: 'Sunday', times: ['12:30 - 12:50', '12:55 - 1:15'] }],
      capacity: 1
    },
    keyBooking: { enabled: true, source: w.teams.id },
    ...patch
  });
  w.book = (key, s) =>
    w.api({
      action: 'submit',
      slug: w.form.slug,
      sourceKey: key,
      data: { slot: s }
    });
  w.rows = () =>
    w.admin({ action: 'admin.submissions', slug: w.form.slug }).submissions;
  return w;
}

test(
  'Key booking: the setting needs a form that issues keys, and only a ' +
    'reservation takes it',
  () => {
    const w = boot();
    assert.deepEqual(
      w
        .admin({ action: 'admin.forms.get', id: w.form.id })
        .keySources.map((s) => s.title),
      ['Database Teams']
    );
    assert.equal(
      w.update({ keyBooking: { enabled: true, source: 'nope' } }).error.code,
      'bad_key_booking'
    );
    assert.equal(
      w.update({ keyBooking: { enabled: true, source: w.form.id } }).error.code,
      'bad_key_booking'
    );
    assert.equal(
      w.admin({
        action: 'admin.forms.update',
        id: w.teams.id,
        patch: { keyBooking: { enabled: true, source: w.form.id } }
      }).error.code,
      'bad_key_booking'
    );
    assert.equal(w.update({ keyBooking: { enabled: false } }).ok, true);
    assert.equal(
      w.api({ action: 'getForm', slug: w.form.slug }).form.keyBooking,
      undefined
    );
  }
);

test(
  'Key booking: the public form names the registration form and ' +
    'nothing else about it',
  () => {
    const w = boot();
    const pub = w.api({ action: 'getForm', slug: w.form.slug }).form;
    assert.deepEqual(pub.keyBooking, { title: 'Database Teams' });
  }
);

test(
  'Key booking: a key shows the team to confirm, with the names of its ' +
    'teammates and no contact details',
  () => {
    const w = boot();
    const res = w.api({
      action: 'bookingTeam',
      slug: w.form.slug,
      key: w.keyA
    });
    assert.deepEqual(res.team, {
      ref: res.team.ref,
      leader: 'أحمد محمد محمود علي',
      code: '4230001',
      title: 'Library System',
      size: 2,
      teammates: ['سارة خالد حسن علي']
    });
    assert.equal(res.booked, false);
    assert.equal(JSON.stringify(res).includes('0101'), false);
    assert.equal(JSON.stringify(res).includes('example.com'), false);
    assert.equal(
      w.api({ action: 'bookingTeam', slug: w.form.slug, key: '00000' }).error
        .code,
      'bad_key'
    );
  }
);

test(
  'Key booking: the booking carries the registration answers and only ' +
    'the slot is sent',
  () => {
    const w = boot();
    const res = w.book(w.keyA, slot(0));
    assert.equal(res.ok, true);
    const row = w.rows()[0];
    assert.equal(row.data.leader_name, 'أحمد محمد محمود علي');
    assert.equal(row.data.leader_code, '4230001');
    assert.equal(row.data.title, 'Library System');
    assert.equal(row.data.section, '4C-TH2');
    assert.deepEqual(row.data.slot, slot(0));
    assert.equal(row.data._source.form, w.teams.id);
    assert.equal(row.slot, 'sunday|12:30 - 12:50');
    assert.deepEqual(
      row.data.members || [],
      [],
      'teammates stay out while the form does not ask for them'
    );
  }
);

test(
  'Key booking: teammates are copied ' + 'when the reservation asks for them',
  () => {
    const w = boot();
    const form = w.admin({ action: 'admin.forms.get', id: w.form.id }).form;
    form.fields.filter((f) => f.role === 'members')[0].enabled = true;
    w.update({ fields: form.fields });
    assert.equal(w.book(w.keyA, slot(0)).ok, true);
    assert.deepEqual(
      w.rows()[0].data.members.map((m) => m.code),
      ['4230501']
    );
  }
);

test(
  'Key booking: answers typed by hand are ignored, a wrong key and a ' +
    'bad slot are refused',
  () => {
    const w = boot();
    const forged = w.api({
      action: 'submit',
      slug: w.form.slug,
      sourceKey: w.keyA,
      data: {
        slot: slot(0),
        leader_name: 'شخص آخر تماما هنا',
        leader_code: '9999999'
      }
    });
    assert.equal(forged.ok, true);
    assert.equal(w.rows()[0].data.leader_code, '4230001');
    assert.equal(
      w.api({ action: 'submit', slug: w.form.slug, data: { slot: slot(1) } })
        .error.code,
      'bad_key'
    );
    assert.equal(w.book('00000', slot(1)).error.code, 'bad_key');
    assert.equal(
      w.book(w.keyB, { day: 'sunday', time: '9:00 - 9:10' }).error.code,
      'invalid'
    );
    assert.equal(w.book(w.keyB, slot(0)).error.code, 'slot_taken');
  }
);

test(
  'Key booking: one booking per team, opened and cancelled by the same ' +
    'key',
  () => {
    const w = boot();
    const first = w.book(w.keyA, slot(0));
    assert.equal(
      first.key,
      w.keyA,
      'the booking answers to the registration key'
    );
    assert.equal(w.book(w.keyA, slot(1)).error.code, 'already_booked');
    assert.equal(
      w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyA }).booked,
      true
    );
    assert.equal(
      w.api({ action: 'lookup', slug: w.form.slug, key: w.keyA }).submission
        .data.title,
      'Library System'
    );
    assert.equal(
      w.api({ action: 'remove', slug: w.form.slug, key: w.keyA }).removed,
      true
    );
    assert.equal(
      w.book(w.keyA, slot(1)).ok,
      true,
      'a cancelled team can book again'
    );
  }
);

test(
  'Key booking: with editing on, a booking can move to another slot ' +
    'and nothing else changes',
  () => {
    const w = boot({
      editKey: { enabled: true, days: 7, allowEdit: true, allowDelete: true }
    });
    assert.equal(w.book(w.keyA, slot(0)).ok, true);
    const before = w.rows()[0];
    const moved = w.api({
      action: 'update',
      slug: w.form.slug,
      key: w.keyA,
      data: {
        slot: slot(1),
        leader_name: 'شخص اخر تماما هنا',
        leader_code: '9999999',
        title: 'Not Their Project'
      }
    });
    assert.equal(moved.ok, true);
    const after = w.rows()[0];
    assert.deepEqual(
      [after.name, after.code, after.title],
      [before.name, before.code, before.title],
      'the team is still the one the key belongs to'
    );
    assert.equal(after.data.slot.time, slot(1).time);
    assert.deepEqual(after.data._source, before.data._source);
    assert.equal(
      w.api({
        action: 'update',
        slug: w.form.slug,
        key: w.keyA,
        data: { slot: { day: 'sunday', time: 'never' } }
      }).error.code,
      'invalid'
    );
    assert.equal(
      w.book(w.keyB, slot(1)).error.code,
      'slot_taken',
      'the slot it moved to is taken'
    );
    assert.equal(
      w.book(w.keyB, slot(0)).ok,
      true,
      'and the slot it left is free'
    );
  }
);

test(
  'Key booking: a team that may cancel its booking may move it, and ' +
    'the key that finds the team says its time',
  () => {
    const w = boot();
    assert.equal(w.book(w.keyA, slot(0)).ok, true);
    const team = w.api({
      action: 'bookingTeam',
      slug: w.form.slug,
      key: w.keyA
    });
    assert.deepEqual(
      [team.booked, team.slot.time, team.canMove],
      [true, slot(0).time, true]
    );
    assert.equal(
      w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyB }).slot,
      undefined,
      'a team with no booking has no time'
    );
    assert.equal(
      w.api({ action: 'lookup', slug: w.form.slug, key: w.keyA }).slotOnly,
      true
    );
    assert.equal(
      w.api({
        action: 'update',
        slug: w.form.slug,
        key: w.keyA,
        data: { slot: slot(1) }
      }).ok,
      true
    );
    assert.equal(w.rows()[0].data.slot.time, slot(1).time);

    w.update({
      editKey: { enabled: true, days: 7, allowEdit: false, allowDelete: false }
    });
    assert.equal(
      w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyA }).canMove,
      false
    );
    assert.equal(
      w.api({
        action: 'update',
        slug: w.form.slug,
        key: w.keyA,
        data: { slot: slot(0) }
      }).error.code,
      'edit_disabled'
    );
  }
);

test('Key booking: a key that expired for editing still books', () => {
  const w = boot();
  w.advanceDays(9);
  assert.equal(
    w.api({ action: 'lookup', slug: w.teams.slug, key: w.keyA }).error.code,
    'key_expired'
  );
  assert.equal(w.book(w.keyA, slot(0)).ok, true);
});

test('Key booking: switched off, the form is filled in by hand again', () => {
  const w = boot();
  w.update({ keyBooking: { enabled: false } });
  assert.equal(w.book(w.keyA, slot(0)).error.code, 'invalid');
  assert.equal(
    w.api({ action: 'bookingTeam', slug: w.form.slug, key: w.keyA }).error.code,
    'key_booking_off'
  );
});

test(
  'Booking series: the first booking is made for a form, and each next ' +
    'one is the last one a week later',
  () => {
    const w = boot();
    const next = (extra = {}) =>
      w.admin({ action: 'admin.bookings.next', source: w.teams.id, ...extra });
    const dated = {
      status: 'open',
      slots: {
        days: [
          {
            label: 'Sunday 14 Nov',
            date: '2027-11-14',
            times: ['12:30 - 12:50', '12:55 - 1:15']
          },
          {
            label: 'Week 11 - Tuesday',
            date: '2027-11-16',
            times: ['12:30 - 12:50']
          },
          { label: 'Any day', times: ['2:00 - 2:20'] }
        ],
        capacity: 2
      }
    };
    w.update(dated);
    assert.equal(
      w.book(w.keyA, { day: 'sunday-14-nov', time: '12:30 - 12:50' }).ok,
      true
    );

    const second = next();
    assert.equal(second.copied, true);
    assert.equal(
      second.form.title,
      w.form.title + ' 2',
      'a title with no number gets one'
    );
    assert.equal(second.form.status, 'draft');
    assert.notEqual(
      second.form.sheetId,
      w.form.sheetId,
      'the copy has its own sheet'
    );
    assert.deepEqual(JSON.parse(JSON.stringify(second.form.keyBooking)), {
      enabled: true,
      source: w.teams.id
    });
    assert.deepEqual(
      second.form.slots.days.map((d) => [d.label, d.date]),
      [
        ['Sunday 21 Nov', '2027-11-21'],
        ['Week 12 - Tuesday', '2027-11-23'],
        ['Any day', '']
      ]
    );
    assert.equal(second.form.slots.capacity, 2);
    assert.equal(
      w.admin({ action: 'admin.submissions', slug: second.form.slug })
        .submissions.length,
      0,
      'bookings are not copied'
    );

    w.admin({
      action: 'admin.forms.update',
      id: second.form.id,
      patch: { title: 'Discussion - Week 2' }
    });
    assert.equal(
      next().form.title,
      'Discussion - Week 3',
      'the number in the title goes up'
    );
    assert.equal(
      next({ title: 'Final discussion' }).form.title,
      'Final discussion'
    );

    assert.equal(
      next({ source: w.form.id }).error.code,
      'bad_key_booking',
      'a reservation has no keys of its own to book with'
    );
  }
);

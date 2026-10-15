const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

function boot(type = 'team_registration', patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({
    action: 'admin.forms.create',
    type,
    title: 'Database Team Project',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: form.id,
    patch: { status: 'open', ...patch }
  });
  w.form = form;
  w.submit = (data, extra = {}) =>
    w.api({ action: 'submit', slug: form.slug, data, ...extra });
  w.rows = () => w.sheet(form.sheetId, 'Responses').rows();
  return w;
}

const sized = (d) => ({
  team_size: String((d.members || []).length + 1),
  ...d
});
const team = (o = {}) =>
  sized({
    email: 'Sara@Example.com',
    leader_name: 'أحمد محمد محمود أحمد',
    leader_code: '4230999',
    phone: '+201012345678',
    major: 'حاسبات',
    level: 'صفر / الأولى',
    section: '4C-TH1',
    curriculum: '2020',
    members: [
      {
        name: 'سارة خالد حسن علي',
        phone: '01112345678',
        code: '4230998',
        level: 'صفر / الأولى',
        curriculum: '2020',
        section: '4C-TH1'
      }
    ],
    title: 'Library System',
    ...o
  });

test('Key: lookup returns the registration and wrong keys are throttled', () => {
  const w = boot();
  const r = w.submit(team());
  const hit = w.api({ action: 'lookup', slug: w.form.slug, key: r.key });
  assert.equal(hit.submission.data.leader_code, '4230999');
  assert.equal(hit.canEdit, true);
  const wrong = r.key === '00000' ? '11111' : '00000';
  for (let i = 0; i < 10; i++)
    assert.equal(
      w.api({ action: 'lookup', slug: w.form.slug, key: wrong }).error.code,
      'bad_key'
    );
  assert.equal(
    w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).error.code,
    'too_many_attempts'
  );
  w.setNow(w.nowMs + 61000);
  assert.equal(
    w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).ok,
    true
  );
});

test('Key: expires after the configured number of days', () => {
  const w = boot();
  const r = w.submit(team());
  w.advanceDays(6);
  assert.equal(
    w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).ok,
    true
  );
  w.advanceDays(2);
  assert.equal(
    w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).error.code,
    'key_expired'
  );
});

test('Key: editing updates the row and keeps the key working', () => {
  const w = boot();
  const r = w.submit(team());
  const upd = w.api({
    action: 'update',
    slug: w.form.slug,
    key: r.key,
    data: team({ title: 'Library System v2', members: [] })
  });
  assert.equal(upd.ok, true);
  assert.equal(w.rows()[1][10], 'Library System v2');
  assert.equal(w.rows().length, 2, 'edits do not create a second row');
  assert.equal(
    w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).ok,
    true
  );
});

test('Key: editing cannot steal another team code', () => {
  const w = boot();
  w.submit(team());
  const b = w.submit(team({ leader_code: '4231234', members: [] }));
  const r = w.api({
    action: 'update',
    slug: w.form.slug,
    key: b.key,
    data: team({ leader_code: '4230999', members: [] })
  });
  assert.equal(r.error.code, 'duplicate');
});

test('Key: deleting frees the code so the team can register again', () => {
  const w = boot();
  const r = w.submit(team());
  assert.equal(
    w.api({ action: 'remove', slug: w.form.slug, key: r.key }).removed,
    true
  );
  assert.equal(
    w.api({ action: 'lookup', slug: w.form.slug, key: r.key }).error.code,
    'bad_key'
  );
  const again = w.submit(team());
  assert.equal(again.ok, true);
  assert.notEqual(again.ref, r.ref);
});

test('Key: per-form switches turn editing, deleting, or keys off', () => {
  const w = boot('team_registration', {
    editKey: { enabled: true, days: 7, allowEdit: false, allowDelete: true }
  });
  const r = w.submit(team());
  assert.equal(
    w.api({ action: 'update', slug: w.form.slug, key: r.key, data: team() })
      .error.code,
    'edit_disabled'
  );
  assert.equal(
    w.api({ action: 'remove', slug: w.form.slug, key: r.key }).ok,
    true
  );

  const off = boot('team_registration', {
    editKey: { enabled: false, days: 7, allowEdit: true, allowDelete: true }
  });
  const r2 = off.submit(team());
  assert.equal(r2.key, '');
  assert.equal(
    off.api({ action: 'lookup', slug: off.form.slug, key: '12345' }).error.code,
    'key_disabled'
  );
});

test('Key: keys are unique across a form', () => {
  const w = boot();
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const r = w.submit(team({ leader_code: String(4240000 + i), members: [] }));
    assert.equal(seen.has(r.key), false);
    seen.add(r.key);
  }
});

test('Keys: the admin can read a student key back; the sheet only holds a sealed copy', () => {
  const w = boot();
  const r = w.submit(team());
  const subs = w.admin({
    action: 'admin.submissions',
    slug: w.form.slug
  }).submissions;
  assert.equal(subs[0].keySeal, undefined, 'the seal never leaves the server');
  assert.equal(subs[0].keyKnown, true);
  const got = w.admin({
    action: 'admin.submission.key',
    slug: w.form.slug,
    submissionId: subs[0].id
  });
  assert.equal(got.key, r.key);
  const raw = w.sheet(w.form.sheetId, 'Responses').getDataRange().getValues();
  assert.ok(
    !JSON.stringify(raw).includes('"' + r.key + '"'),
    'the plain key is not in the sheet'
  );
  assert.ok(raw[0].includes('keySeal'));
  assert.equal(
    w.api({
      action: 'admin.submission.key',
      slug: w.form.slug,
      submissionId: subs[0].id
    }).error.code,
    'bad_pin',
    'needs the PIN'
  );
  const fresh = w.admin({
    action: 'admin.submission.resetKey',
    slug: w.form.slug,
    submissionId: subs[0].id
  });
  assert.equal(
    w.admin({
      action: 'admin.submission.key',
      slug: w.form.slug,
      submissionId: subs[0].id
    }).key,
    fresh.key,
    'a reset key can be shown too'
  );
});

test('Keys: registrations made before sealing say so and point to Reset key', () => {
  const w = boot();
  w.submit(team());
  const sh = w.sheet(w.form.sheetId, 'Responses');
  const vals = sh.getDataRange().getValues();
  sh.getRange(2, vals[0].indexOf('keySeal') + 1).setValue('');
  const sub = w.admin({ action: 'admin.submissions', slug: w.form.slug })
    .submissions[0];
  assert.equal(sub.keyKnown, false);
  assert.equal(
    w.admin({
      action: 'admin.submission.key',
      slug: w.form.slug,
      submissionId: sub.id
    }).error.code,
    'key_unknown'
  );
});

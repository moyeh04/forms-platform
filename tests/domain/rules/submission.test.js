const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');
const { teamForm, base } = require('../../fixtures/team-form.js');

test('Submission: valid data is cleaned', () => {
  const r = R.validateSubmission(teamForm, base());
  assert.equal(r.ok, true);
  assert.equal(r.data.email, 'a@b.com');
  assert.equal(r.data.phone, '01012345678');
});

test('Submission: reports field and nested member errors', () => {
  const d = base();
  d.leader_name = 'Ahmed';
  d.members = [{ name: 'سارة', code: '1' }];
  const r = R.validateSubmission(teamForm, d);
  assert.equal(r.ok, false);
  assert.equal(r.errors.leader_name.error, 'arabic_only');
  assert.equal(r.errors.members.nested['0.name'].error, 'arabic_parts');
  assert.equal(r.errors.members.nested['0.code'].error, 'invalid_code');
});

test('Submission: blocks the same code twice and too many members', () => {
  const d = base();
  d.members = [{ name: 'سارة خالد حسن علي', code: '4230999' }];
  assert.equal(
    R.validateSubmission(teamForm, d).errors.members.nested['0.code'].error,
    'duplicate_code'
  );
  d.members = [1, 2, 3].map((n) => ({
    name: 'سارة خالد حسن علي',
    code: '423099' + n
  }));
  assert.equal(
    R.validateSubmission(teamForm, d).errors.members.error,
    'too_many_members'
  );
});

test('Slot validation: day and time must exist on the form', () => {
  const form = { slots: { days: [{ id: 'w1', times: ['1:00 - 1:10'] }] } };
  const f = { id: 'slot', type: 'slot' };
  assert.equal(
    R.validateField(f, { day: 'w1', time: '1:00 - 1:10' }, { form }).ok,
    true
  );
  assert.equal(
    R.validateField(f, { day: 'w1', time: '9:00 - 9:10' }, { form }).error,
    'invalid_slot'
  );
  assert.equal(R.validateField(f, null, { form }).error, 'required');
});

test('Submission: disabled fields are skipped, inside members too', () => {
  const form = {
    fields: [
      { id: 'a', type: 'text' },
      { id: 'link', type: 'drive_link', enabled: false },
      {
        id: 'members',
        type: 'members',
        max: 2,
        fields: [
          { id: 'name', type: 'text' },
          { id: 'extra', type: 'code', enabled: false }
        ]
      }
    ]
  };
  const r = R.validateSubmission(form, { a: 'x', members: [{ name: 'y' }] });
  assert.equal(r.ok, true);
  assert.equal('link' in r.data, false);
});

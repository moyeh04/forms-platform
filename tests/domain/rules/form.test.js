const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');
const { teamForm, base } = require('../../fixtures/team-form.js');

test('Helpers: members list, role lookup and form state', () => {
  const list = R.membersOf(
    teamForm,
    R.validateSubmission(teamForm, base()).data
  );
  assert.equal(list.length, 2);
  assert.equal(list[0].leader, true);
  assert.equal(R.fieldByRole(teamForm, 'title').id, 'title');
  const now = Date.parse('2027-09-01T00:00:00Z');
  assert.equal(R.formState({ status: 'open' }, now), 'open');
  assert.equal(
    R.formState({ status: 'open', opensAt: '2027-10-01T00:00:00Z' }, now),
    'not_yet'
  );
  assert.equal(
    R.formState({ status: 'open', closesAt: '2027-08-01T00:00:00Z' }, now),
    'closed'
  );
  assert.equal(R.formState({ status: 'draft' }, now), 'draft');
});

test('People: leaders and members are counted, a student code once', () => {
  const row = (code, members = []) => ({
    data: { leader_name: 'x', leader_code: code, members }
  });
  assert.equal(R.countPeople(teamForm, []), 0);
  assert.equal(
    R.countPeople(teamForm, [
      row('1', [
        { name: 'a', code: '2' },
        { name: 'b', code: '3' }
      ]),
      row('4')
    ]),
    4
  );
  assert.equal(
    R.countPeople(teamForm, [
      row('1', [{ name: 'a', code: '2' }]),
      row('2', [{ name: 'c', code: '1' }])
    ]),
    2,
    'a code in two responses is one person'
  );
  assert.equal(
    R.countPeople(teamForm, [row('', [{ name: 'a', code: '' }]), row('')]),
    3,
    'without a code nobody can be matched, so each counts'
  );
  const solo = {
    fields: [
      { id: 'leader_name', role: 'name' },
      { id: 'leader_code', role: 'code' },
      { id: 'members', role: 'members', enabled: false }
    ]
  };
  assert.equal(
    R.countPeople(solo, [row('1', [{ name: 'a', code: '2' }])]),
    1,
    'teammates a form does not ask about are not counted'
  );
});

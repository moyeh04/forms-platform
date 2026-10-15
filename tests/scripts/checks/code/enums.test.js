const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkSource
} = require('../../../../scripts/checks/code/check-enums.js');

const RULES = {
  properties: { type: 'FormType', review: 'ReviewStatus' },
  enums: {
    FormType: { RESERVATION: 'reservation', TEAM: 'team' },
    ReviewStatus: { APPROVED: 'approved' }
  }
};

const problems = (source) =>
  checkSource('a.js', source, RULES).map((f) => `${f.line} ${f.message}`);

test('Enum check: a value of a mapped enum written by hand is found', () => {
  const source = `
if (form.type === 'reservation') book();
const same = 'team' !== f.type;
if (r.review[step.id] === 'approved') next();
switch (form.type) {
  case 'team':
    break;
}
`;
  assert.deepEqual(problems(source), [
    "2 write FormType.RESERVATION, not 'reservation'",
    "3 write FormType.TEAM, not 'team'",
    "4 write ReviewStatus.APPROVED, not 'approved'",
    "6 write FormType.TEAM, not 'team'"
  ]);
});

test('Enum check: members, other words and unmapped properties pass', () => {
  const source = `
if (form.type === FormType.RESERVATION) book();
if (field.type === 'select') pick();
if (t.status === 'reservation') odd();
if (type === 'reservation') local();
switch (kind) {
  case 'team':
    break;
}
`;
  assert.deepEqual(problems(source), []);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');

test('Codes: seven digits by default', () => {
  assert.equal(R.validateCode('4230999').ok, true);
  assert.equal(R.validateCode('٤٢٣٠٩٩٩').value, '4230999');
  assert.equal(R.validateCode('42309').error, 'invalid_code');
  assert.equal(R.validateCode('42A0999').error, 'invalid_code');
});

test('Codes: a question gives its own length, seven when it has none', () => {
  assert.equal(R.codeLength({ length: 9 }), 9);
  assert.equal(R.codeLength({}), 7);
  assert.equal(R.codeLength(null), 7);
});

test('Edit keys: five digits, as the page asks and the backend makes', () => {
  assert.equal(R.editKeyDigits(), 5);
  assert.equal(R.isEditKey('01234'), true);
  assert.equal(R.isEditKey('1234'), false);
  assert.equal(R.isEditKey('123456'), false);
  assert.equal(R.isEditKey('12a45'), false);
});

test(
  'Access keys: six digits, as the instructor page asks and the ' +
    'backend makes',
  () => {
    assert.equal(R.accessKeyDigits(), 6);
  }
);

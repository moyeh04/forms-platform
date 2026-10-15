const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');

test('Arabic names: accepts four Arabic parts and strips diacritics', () => {
  const ok = R.validateArabicName('أحمد محمد محمود أحمد');
  assert.equal(ok.ok, true);
  assert.equal(
    R.validateArabicName('أَحْمَد  مُحَمَّد مَحمود أحمد').value,
    'أحمد محمد محمود أحمد'
  );
});

test('Arabic names: rejects English letters, digits and short names', () => {
  assert.equal(
    R.validateArabicName('Ahmed Mohamed Mahmoud Ahmed').error,
    'arabic_only'
  );
  assert.equal(R.validateArabicName('أحمد محمد 123 أحمد').error, 'arabic_only');
  assert.equal(R.validateArabicName('أحمد محمد محمود').error, 'arabic_parts');
  assert.equal(
    R.validateArabicName('أحمد محمد محمود', { minParts: 3 }).ok,
    true
  );
  assert.equal(R.validateArabicName('   ').error, 'required');
});

test('Arabic names: live cleaning keeps trailing space while typing', () => {
  const live = R.cleanArabicName('أحمد ABC محمد ', false);
  assert.equal(live.blocked, true);
  assert.equal(live.value, 'أحمد محمد ');
  assert.equal(R.cleanArabicName('أحمد ', true).value, 'أحمد');
});

test('English text: rejects Arabic letters', () => {
  assert.equal(R.validateEnglishText('Library System').ok, true);
  assert.equal(R.validateEnglishText('نظام المكتبة').error, 'english_only');
  assert.equal(R.validateEnglishText('A').error, 'too_short');
});

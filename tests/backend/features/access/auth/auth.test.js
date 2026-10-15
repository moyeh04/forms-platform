const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (body) => w.api({ ...body, admin: { pin: '4321' } });
  return w;
}

test('Admin: wrong PIN is rejected and repeated guesses lock out', () => {
  const w = boot();
  assert.equal(
    w.api({ action: 'admin.login', admin: { pin: '4321' } }).ok,
    true
  );
  for (let i = 0; i < 8; i++)
    assert.equal(
      w.api({ action: 'admin.login', admin: { pin: '0000' } }).error.code,
      'bad_pin'
    );
  assert.equal(
    w.api({ action: 'admin.login', admin: { pin: '4321' } }).error.code,
    'locked'
  );
  w.advanceDays(1);
  assert.equal(
    w.api({ action: 'admin.login', admin: { pin: '4321' } }).ok,
    true
  );
});

test('Admin: unlocking from the sheet menu lifts a lock and keeps the PIN', () => {
  const w = boot();
  assert.equal(w.call('unlockAdmin'), false, 'nothing to unlock');
  for (let i = 0; i < 8; i++)
    w.api({ action: 'admin.login', admin: { pin: '0000' } });
  const locked = w.api({ action: 'admin.login', admin: { pin: '4321' } }).error;
  assert.equal(locked.code, 'locked');
  assert.match(
    locked.message,
    /unlock the admin page from the Forms Platform menu/
  );
  assert.equal(w.call('unlockAdmin'), true);
  assert.equal(
    w.api({ action: 'admin.login', admin: { pin: '4321' } }).ok,
    true
  );
  assert.equal(
    w.api({ action: 'admin.login', admin: { pin: '0000' } }).error.code,
    'bad_pin',
    'wrong tries count from zero again'
  );
});

test('Admin: actions need the PIN and PIN must be long enough', () => {
  const w = boot();
  assert.equal(w.api({ action: 'admin.forms.list' }).error.code, 'bad_pin');
  assert.throws(() => w.call('setAdminPin', '12'), /at least 4/);
});

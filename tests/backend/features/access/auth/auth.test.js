const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (body) => w.api({ ...body, admin: { pin: '4321' } });
  w.login = (pin, device) =>
    w.api({ action: 'admin.login', admin: { pin, device } });
  return w;
}

function wrongTries(w, n, device) {
  const codes = [];
  for (let i = 0; i < n; i++) codes.push(w.login('0000', device).error.code);
  return codes;
}

test('Admin: wrong PIN is rejected and repeated guesses lock out', () => {
  const w = boot();
  assert.equal(w.login('4321').ok, true);
  assert.deepEqual(wrongTries(w, 8), Array(8).fill('bad_pin'));
  assert.equal(w.login('4321').error.code, 'locked');
  w.advanceDays(1);
  assert.equal(w.login('4321').ok, true);
});

test('Admin: unlocking from the sheet menu lifts every lock', () => {
  const w = boot();
  const pass = w.login('4321').device;
  assert.equal(w.call('unlockAdmin'), false, 'nothing to unlock');
  wrongTries(w, 8);
  wrongTries(w, 8, pass);
  const locked = w.login('4321').error;
  assert.equal(locked.code, 'locked');
  assert.match(
    locked.message,
    /unlock the admin page from the Forms Platform menu/
  );
  assert.equal(w.call('unlockAdmin'), true);
  assert.equal(w.login('4321').ok, true);
  assert.equal(w.login('4321', pass).ok, true);
  assert.equal(
    wrongTries(w, 1)[0],
    'bad_pin',
    'wrong tries count from zero again'
  );
});

test('Admin: PINs sent at the same time are counted one by one', () => {
  const w = boot();
  wrongTries(w, 7);
  // Another request fills the count just as this one is checked.
  w.beforeLock = () => wrongTries(w, 1);
  assert.equal(w.login('4321').error?.code, 'locked');
});

test('Admin: a signed-in device is counted apart from strangers', () => {
  const w = boot();
  const pass = w.login('4321').device;
  assert.match(pass, /^[0-9a-f]{64}$/);
  assert.equal(w.login('4321', pass).device, pass, 'the same pass comes back');
  wrongTries(w, 8);
  assert.equal(w.login('4321').error.code, 'locked');
  assert.equal(w.login('4321', pass).ok, true, 'the trusted device gets in');
  assert.equal(
    w.api({ action: 'admin.forms.list', admin: { pin: '4321', device: pass } })
      .ok,
    true
  );
  assert.equal(
    w.login('4321', 'f'.repeat(64)).error.code,
    'locked',
    'a made-up pass counts as a stranger'
  );
  wrongTries(w, 8, pass);
  const own = w.login('4321', pass).error;
  assert.equal(own.code, 'device_locked', 'its own wrong PINs lock only it');
  assert.match(own.message, /on this device/);
});

test('Admin: a pass ends after the days set, and can be forgotten', () => {
  const w = boot();
  const pass = w.login('4321').device;
  w.advanceDays(29);
  assert.equal(w.login('4321', pass).device, pass);
  w.advanceDays(2);
  const next = w.login('4321', pass).device;
  assert.notEqual(next, pass, 'after 30 days the browser gets a new pass');
  assert.equal(w.call('AuthDevices.setDays', '1'), 1);
  w.advanceDays(2);
  assert.notEqual(w.login('4321', next).device, next, 'a shorter time ends it');
  assert.throws(() => w.call('AuthDevices.setDays', '0'), /whole number/);
  assert.throws(() => w.call('AuthDevices.setDays', 'ten'), /whole number/);
  const last = w.login('4321').device;
  assert.equal(w.call('AuthDevices.forgetAll') >= 1, true);
  wrongTries(w, 8);
  assert.equal(w.login('4321', last).error.code, 'locked', 'forgotten');
});

test('Admin: a new PIN forgets every trusted device', () => {
  const w = boot();
  const pass = w.login('4321').device;
  w.call('setAdminPin', '9876');
  wrongTries(w, 8);
  assert.equal(w.login('9876', pass).error.code, 'locked');
});

test('Admin: actions need the PIN and PIN must be long enough', () => {
  const w = boot();
  assert.equal(w.api({ action: 'admin.forms.list' }).error.code, 'bad_pin');
  assert.throws(() => w.call('setAdminPin', '12'), /at least 4/);
});

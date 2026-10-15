const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../harness/appsscript-mock.js');

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (body) => w.api({ ...body, admin: { pin: '4321' } });
  return w;
}

test('Router: unknown actions and bad JSON return clean errors', () => {
  const w = boot();
  assert.equal(w.api({ action: 'nope' }).error.code, 'unknown_action');
  const out = w.ctx.doPost({ postData: { contents: '{bad' } });
  assert.equal(JSON.parse(out.getContent()).error.code, 'bad_json');
  assert.equal(
    w.api({ action: 'getForm', slug: 'missing' }).error.code,
    'form_not_found'
  );
});

test('Router: a route that could open an action stops the load', () => {
  const w = boot();
  const { Router, Access } = w.ctx;
  const handler = () => ({});
  const guards = {};
  const refused = (routes, message) =>
    assert.throws(() => Router.create(routes, guards), { message });
  refused([{ action: 'a', handler }], 'The route a names no valid access.');
  refused(
    [{ action: 'a', access: 'anyone', handler }],
    'The route a names no valid access.'
  );
  refused(
    [{ action: 'a', access: Access.PUBLIC }],
    'The route a has no handler.'
  );
  refused(
    [
      { action: 'a', access: Access.PUBLIC, handler },
      { action: 'a', access: Access.ADMIN, handler }
    ],
    'The route a is listed twice.'
  );
});

test('Router: link and admin checks run before the handler', () => {
  const w = boot();
  const { Router, Access } = w.ctx;
  const calls = [];
  const router = Router.create(
    [
      {
        action: 'link',
        access: Access.CLIENT,
        handler: (_req, client) => ({ seen: client.name })
      },
      {
        action: 'pin',
        access: Access.ADMIN,
        handler: () => {
          calls.push('handler');
          return {};
        }
      }
    ],
    {
      requireAdmin: () => {
        calls.push('check');
        w.ctx.ApiError.fail('bad_pin', 'No.');
      },
      requireClient: () => ({ name: 'Client 1' })
    }
  );
  assert.equal(router.reply({ action: 'link' }).seen, 'Client 1');
  assert.equal(router.reply({ action: 'pin' }).error.code, 'bad_pin');
  assert.deepEqual(calls, ['check']);
  assert.deepEqual([...router.actions()], ['link', 'pin']);
});

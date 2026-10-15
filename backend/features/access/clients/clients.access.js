/**
 * Who may use a link: its token, its key, its end date and the lock-out after
 * wrong keys.
 */

var CLIENT_KEY_TRIES_ = 5;

/** Resolves a token to an active client, or fails. */
function requireClient_(req) {
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get('bad_tokens') || '0', 10);
  if (fails >= 30)
    fail(
      'too_many_attempts',
      'Too many tries. Wait a minute and open the link again.'
    );
  var token = String((req && req.token) || '');
  var h = token ? clientToken_(token) : '';
  var hit = null;
  readClients_().forEach(function (c) {
    if (h && c.tokenHash === h) hit = c;
  });
  if (!hit) {
    cache.put('bad_tokens', String(fails + 1), 60);
    fail('bad_token', 'This link is not valid.');
  }
  if (!hit.active) fail('revoked', 'This link was turned off.');
  if (clientExpired_(hit))
    fail(
      'link_expired',
      'This link ended on ' +
        hit.expires.slice(0, 10) +
        '. Ask whoever sent it to extend it.'
    );
  if (hit.keyHash) {
    var tag = 'client_key:' + hit.id;
    var wrong = parseInt(cache.get(tag) || '0', 10);
    if (wrong >= CLIENT_KEY_TRIES_)
      fail(
        'key_locked',
        'Too many wrong keys. Wait ten minutes and try again.'
      );
    var key = String((req && req.accessKey) || '').replace(/\D/g, '');
    if (!key) fail('key_needed', 'This link needs its access key.');
    if (clientKeyHash_(hit, key) !== hit.keyHash) {
      cache.put(tag, String(wrong + 1), 600);
      fail('bad_access_key', 'That access key is not right.');
    }
  }
  return hit;
}

function clientAllows_(client, form) {
  return (
    client.forms.indexOf('*') !== -1 || client.forms.indexOf(form.id) !== -1
  );
}

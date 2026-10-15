/** The script lock every write runs under, safe to nest. */

var Lock = (function () {
var LOCK_DEPTH_ = 0;

/**
 * Runs `fn` while this request alone may write. Everything that reads a row and writes it back
 * does both inside, so the row cannot move or change in between. A call made inside another
 * shares its lock.
 */
function withLock_(fn) {
  if (LOCK_DEPTH_) return fn();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    ApiError.fail('busy', 'The server is busy. Try again in a moment.');
  }
  LOCK_DEPTH_++;
  try {
    return fn();
  } finally {
    LOCK_DEPTH_--;
    lock.releaseLock();
  }
}

return { withLock: withLock_ };
})();

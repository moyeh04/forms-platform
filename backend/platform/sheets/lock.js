/** The script lock every write runs under, safe to nest. */

var Lock = (function () {
  /** How long a request waits for the lock before it gives up, in ms. */
  var LOCK_WAIT_MS_ = 20000;

  /** How many calls of withLock the current request is inside. */
  var LOCK_DEPTH_ = 0;

  /**
   * Runs `fn` while this request alone may write. Everything that reads a
   * row and writes it back does both inside, so the row cannot move or
   * change in between. A call made inside another shares its lock.
   *
   * @param {function(): T} fn The work.
   * @return {T} What the work returns.
   * @template T
   */
  function withLock_(fn) {
    if (LOCK_DEPTH_) return fn();
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(LOCK_WAIT_MS_);
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

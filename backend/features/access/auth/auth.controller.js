/** The admin login action. */

var AuthController = (function () {
  /**
   * Answers the `admin.login` action.
   *
   * @return {*} The answer, sent back as JSON.
   */
  function login() {
    return { admin: true };
  }

  return { login };
})();

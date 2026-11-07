/** The admin login action. */

var AuthController = (function () {
  /**
   * Answers the `admin.login` action, which runs after the PIN check. The
   * browser keeps the pass it gets, so it is counted apart from strangers.
   *
   * @param {?Object} req The request; `admin.device` may hold a pass.
   * @return {*} The answer, sent back as JSON: `device`, the browser's pass.
   */
  function login(req) {
    var pass = req?.admin?.device;
    return {
      admin: true,
      device: AuthDevices.known(pass) ? pass : AuthDevices.issue()
    };
  }

  return { login };
})();

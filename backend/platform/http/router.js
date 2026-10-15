/**
 * Finds the handler of each request and runs it. The router refuses an action
 * it does not know, runs the check the action's access asks for, and turns
 * what the handler returns or throws into the reply the web app sends.
 */

var Router = (function () {
  /**
   * Refuses a row of the routes table that could open an action by accident.
   *
   * @param {!Object} route The row: action, access and handler.
   * @param {!Map<string, !Object>} table The rows accepted so far.
   */
  function checkRoute_(route, table) {
    var levels = Object.keys(Access).map(function (name) {
      return Access[name];
    });
    if (levels.indexOf(route.access) === -1)
      throw new Error('The route ' + route.action + ' names no valid access.');
    if (typeof route.handler !== 'function')
      throw new Error('The route ' + route.action + ' has no handler.');
    if (table.has(route.action))
      throw new Error('The route ' + route.action + ' is listed twice.');
  }

  /**
   * Runs a handler after the check its access asks for. A client handler gets
   * the checked link as its second argument.
   *
   * @param {!Object} route The row of the action.
   * @param {!Object} req The request body.
   * @param {!Object} guards The checks: requireAdmin and requireClient.
   * @return {*} What the handler returns.
   */
  function run_(route, req, guards) {
    if (route.access === Access.ADMIN) guards.requireAdmin(req);
    if (route.access === Access.CLIENT)
      return route.handler(req, guards.requireClient(req));
    return route.handler(req);
  }

  /**
   * The reply to an error a handler threw. An ApiError is the answer the
   * handler meant to give; anything else is logged and hidden.
   *
   * @param {*} err What the handler threw.
   * @param {*} action The action of the request.
   * @return {!Object} The reply.
   */
  function errorReply_(err, action) {
    if (err?.isApiError)
      return {
        ok: false,
        error: { code: err.code, message: err.message, details: err.details }
      };
    Logger.log(
      'Unhandled error in ' + action + ': ' + (err?.stack ? err.stack : err)
    );
    return {
      ok: false,
      error: {
        code: 'server_error',
        message: 'Something went wrong on the server. Try again.'
      }
    };
  }

  /**
   * Builds the router of a routes table. A bad row stops the script while it
   * loads, before any request is answered.
   *
   * @param {!Array<!Object>} routes One row for each action: action, access
   *     (one of `Access`) and handler.
   * @param {!Object} guards The checks the router runs: requireAdmin(req)
   *     and requireClient(req), which returns the link.
   * @return {{reply: function(!Object): !Object, actions: function():
   *     !Array<string>}} The router.
   */
  function create(routes, guards) {
    var table = new Map();
    routes.forEach(function (route) {
      checkRoute_(route, table);
      table.set(route.action, route);
    });

    /**
     * Answers one request.
     *
     * @param {!Object} req The request body.
     * @return {!Object} The reply: ok with what the handler returned, or the
     *     error.
     */
    function reply(req) {
      var route = table.get(String(req.action || ''));
      if (!route)
        return {
          ok: false,
          error: { code: 'unknown_action', message: 'Unknown action.' }
        };
      try {
        return Object.assign({ ok: true }, run_(route, req, guards));
      } catch (err) {
        return errorReply_(err, req.action);
      }
    }

    /**
     * Lists the actions the router answers.
     *
     * @return {!Array<string>} The action names, in the order of the table.
     */
    function actions() {
      return Array.from(table.keys());
    }

    return { reply: reply, actions: actions };
  }

  return { create };
})();

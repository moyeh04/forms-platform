/**
 * Who may call an action. Every route names one of these, and the router
 * refuses a route that names none, so no action is open by accident.
 */

var Access = Object.freeze({
  /** A verified admin: the router checks the PIN before the handler runs. */
  ADMIN: 'admin',
  /** A private link: the router checks it and hands it to the handler. */
  CLIENT: 'client',
  /** The holder of a registration key, which the service checks itself. */
  KEY: 'key',
  /** Anyone. */
  PUBLIC: 'public'
});

/**
 * The name of the app, the registry tab names, and the form statuses.
 */

var Constants = (function () {
  var APP = { name: 'Forms Platform', version: '1.0.0' };

  var TABS = { forms: 'Forms', clients: 'Clients', lists: 'Lists' };

  var FORM_STATUSES = ['draft', 'open', 'closed', 'archived'];

  return { APP, TABS, FORM_STATUSES };
})();

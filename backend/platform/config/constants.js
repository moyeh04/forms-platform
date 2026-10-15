/**
 * The name of the app, the registry tab names, and the form types and statuses.
 */

var Constants = (function () {
  var APP = { name: 'Forms Platform', version: '1.0.0' };

  var TABS = { forms: 'Forms', clients: 'Clients', lists: 'Lists' };

  var FORM_TYPES = [
    'team_registration',
    'task_submission',
    'reservation',
    'whatsapp_registration'
  ];

  var FORM_STATUSES = ['draft', 'open', 'closed', 'archived'];

  return { APP, TABS, FORM_TYPES, FORM_STATUSES };
})();

/**
 * The shared validation rules, one source of truth for the browser form,
 * the dashboards, the Node tests and the Apps Script backend. Everything is
 * pure: no DOM, no Apps Script services.
 *
 * This file gathers the parts into the one global `Rules`. In Node it
 * requires them; the pages and the bundle load the enums and every part
 * before it, each part after the parts it reads.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var parts = node
    ? [
        require('./text.js'),
        require('./phone.js'),
        require('./codes.js'),
        require('./drive-link.js'),
        require('./slots.js'),
        require('./form.js'),
        require('./team-size.js'),
        require('./progress.js'),
        require('./progress-marks.js'),
        require('./submission.js')
      ]
    : [
        root.RulesText,
        root.RulesPhone,
        root.RulesCodes,
        root.RulesDriveLink,
        root.RulesSlots,
        root.RulesForm,
        root.RulesTeamSize,
        root.RulesProgress,
        root.RulesProgressMarks,
        root.RulesSubmission
      ];

  var api = {};
  parts.forEach(function (part) {
    Object.keys(part).forEach(function (name) {
      api[name] = part[name];
    });
  });
  if (node) module.exports = api;
  root.Rules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

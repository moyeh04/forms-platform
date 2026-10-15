/**
 * The words the browser and the backend share for what a form is and where
 * it stands. Each member names a value as the sheets store it and the API
 * sends it, so a value never changes; code compares with the member, never
 * with the word.
 *
 * The pages, the Node tests and the Apps Script backend (the bundler puts
 * this file first) all load it. Each enum becomes a global of its own name.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  Object.keys(api).forEach(function (name) {
    root[name] = api[name];
  });
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** What a form collects. */
  var FormType = Object.freeze({
    TEAM_REGISTRATION: 'team_registration',
    TASK_SUBMISSION: 'task_submission',
    RESERVATION: 'reservation',
    WHATSAPP_REGISTRATION: 'whatsapp_registration'
  });

  /** Where a form stands: only an open form takes registrations. */
  var FormStatus = Object.freeze({
    DRAFT: 'draft',
    OPEN: 'open',
    CLOSED: 'closed',
    ARCHIVED: 'archived'
  });

  /** The answer of one review step to a registration. */
  var ReviewStatus = Object.freeze({
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  });

  /** How the choices of a list are made and shown. */
  var ListKind = Object.freeze({
    SECTIONS: 'sections',
    NUMBERS: 'numbers',
    NAMED: 'named',
    PLAIN: 'plain',
    MILESTONES: 'milestones'
  });

  /** Where a team stands on one milestone of its project. */
  var ProgressState = Object.freeze({
    NOT_YET: 'not_yet',
    SUBMITTED: 'submitted',
    DISCUSSED: 'discussed'
  });

  /** What an instructor link may do with the progress of teams. */
  var ProgressAccess = Object.freeze({
    HIDDEN: 'hidden',
    SEE: 'see',
    MARK: 'mark'
  });

  return {
    FormType: FormType,
    FormStatus: FormStatus,
    ReviewStatus: ReviewStatus,
    ListKind: ListKind,
    ProgressState: ProgressState,
    ProgressAccess: ProgressAccess
  };
});

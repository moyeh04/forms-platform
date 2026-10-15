/**
 * The words and sizes the whole dashboard shares: the kinds of form, the
 * statuses and their labels, the tabs of a form, and the links of a form
 * and of an instructor page. Loaded first of the dashboard parts; creates
 * `App.admin`, which every other part adds to.
 */
(function (App) {
  'use strict';

  App.admin = { views: {} };
  var A = App.admin;

  /** The sizes of the dashboard's icons, in pixels. */
  A.ICON_SIZE = {
    MENU: 16,
    LINE: 18,
    BUTTON: 20,
    CARD: 22,
    PICK: 24,
    PREVIEW: 26
  };

  /**
   * What each kind of form is: `text` says what it is for, `pages` are the
   * pages students go through (the same as the template in
   * templates.service.js), `next` is what to set up after creating it.
   */
  A.TYPES = {
    team_registration: {
      label: 'Team registration',
      icon: 'team',
      text: 'Teams sign up once: a leader, the members and a project title.',
      pages: ['About you', 'Study details', 'Team members', 'Project'],
      next: [
        'Set the smallest and the largest team.',
        'Choose who can register.'
      ]
    },
    task_submission: {
      label: 'Task submission',
      icon: 'task',
      text: 'Teams hand in a task with a link to their work.',
      pages: ['About you', 'Study details', 'Team members', 'Task'],
      next: [
        'Set the team size.',
        'Check the rule for the links students send.'
      ]
    },
    reservation: {
      label: 'Reservation',
      icon: 'calendar',
      text: 'Teams book one time slot on a day that you offer.',
      pages: ['About you', 'Study details', 'Project', 'Time slot'],
      next: [
        'Add the days and times in the Timetable tab.',
        'Choose how many bookings one slot takes.'
      ]
    },
    whatsapp_registration: {
      label: 'WhatsApp group registration',
      icon: 'chat',
      text:
        'Students ask to join a group, and you check each one against the' +
        ' join requests.',
      pages: ['About you', 'Study details', 'Schedule'],
      next: ['Paste the join requests under Responses to match them.']
    }
  };

  /** The label of each status of a form. */
  A.STATUS_LABEL = {
    draft: 'Draft',
    open: 'Open',
    closed: 'Closed',
    archived: 'Archived'
  };

  /** The order of the forms list: what students can reach now comes first. */
  A.STATUSES = [
    FormStatus.OPEN,
    FormStatus.DRAFT,
    FormStatus.CLOSED,
    FormStatus.ARCHIVED
  ];

  /** The statuses of a submission, in the order they are offered. */
  A.SUB_STATUSES = ['new', 'in_review', 'approved', 'rejected', 'done'];

  /** The label of each status of a submission and of a review. */
  A.SUB_LABEL = {
    new: 'New',
    in_review: 'In review',
    approved: 'Approved',
    rejected: 'Rejected',
    done: 'Done',
    pending: 'Pending'
  };

  /** The answers of a review, in the order they are offered. */
  A.REVIEW = [
    ReviewStatus.PENDING,
    ReviewStatus.APPROVED,
    ReviewStatus.REJECTED
  ];

  /** The tabs of a form, the answers first. */
  A.FORM_TABS = ['responses', 'questions', 'timetable', 'settings'];

  /** The seasons a term is named after. */
  A.SEASONS = ['Fall', 'Spring', 'Summer'];

  /** The length of a date written as YYYY-MM-DD. */
  var ISO_DATE_LENGTH = 10;

  /**
   * Gives the address students open a form at.
   *
   * @param {string} slug The short name of the form.
   * @return {string} The address.
   */
  A.formLink = function (slug) {
    return new URL(
      'index.html?f=' + encodeURIComponent(slug),
      window.location.href
    ).href;
  };

  /**
   * Gives the address of an instructor or client page.
   *
   * @param {string} token The private token of the link.
   * @return {string} The address.
   */
  A.viewerLink = function (token) {
    return new URL(
      'viewer.html?t=' + encodeURIComponent(token),
      window.location.href
    ).href;
  };

  /**
   * Writes a count with its noun, such as "1 team" or "3 teams".
   *
   * @param {number} n The count.
   * @param {string} one The noun for one.
   * @param {string} many The noun for more.
   * @return {string} The words.
   */
  A.plural = function (n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  };

  /**
   * Writes the day of a moment as YYYY-MM-DD.
   *
   * @param {*} iso The moment.
   * @return {string} The day, the value as given when it is not a date, or
   *     '' when there is none.
   */
  A.fmtDate = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? String(iso)
      : d.toISOString().slice(0, ISO_DATE_LENGTH);
  };

  /**
   * Reads a term such as "Fall 2025" into its season and academic year. A
   * term in another shape is kept as written.
   *
   * @param {*} term The term.
   * @return {{season: string, year: string, custom: string}} Its parts.
   */
  A.parseTerm = function (term) {
    var m = String(term || '')
      .trim()
      .match(/^(fall|spring|summer)\s+(\d{4}(?:\/\d{4})?)$/i);
    if (!m) return { season: '', year: '', custom: String(term || '').trim() };
    var year =
      m[2].indexOf('/') === -1 ? m[2] + '/' + (parseInt(m[2], 10) + 1) : m[2];
    return {
      season: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(),
      year: year,
      custom: ''
    };
  };
})(window.App);

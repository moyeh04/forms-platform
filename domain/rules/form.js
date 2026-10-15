/**
 * The rules that read a form and its responses: a field by its role, the
 * people on a submission, how many people a form holds, and whether it is
 * open.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var enums = node ? require('../enums.js') : root;

  var FormStatus = enums.FormStatus;

  /**
   * Finds the field of a form that has a role.
   *
   * @param {?Object} form The form.
   * @param {string} role The role, such as 'name' or 'members'.
   * @return {?Object} The first field with that role, or null.
   */
  function fieldByRole(form, role) {
    var f = form || {};
    var fields = f.fields || [];
    var found = fields.filter(function (field) {
      return field.role === role;
    });
    return found.length ? found[0] : null;
  }

  /**
   * Reads the answer to the field that has a role.
   *
   * @param {?Object} form The form.
   * @param {?Object} data The answers, by field id.
   * @param {string} role The role.
   * @return {*} The answer, or undefined when there is no such field.
   */
  function valueByRole(form, data, role) {
    var f = fieldByRole(form, role);
    return f && data ? data[f.id] : undefined;
  }

  /**
   * Reads the members a submission lists, when the form takes members.
   *
   * @param {?Object} form The form.
   * @param {?Object} data The answers.
   * @return {!Array<!Object>} The members as typed.
   */
  function memberList(form, data) {
    var mf = fieldByRole(form, 'members');
    if (!mf || mf.enabled === false || !data) return [];
    return Array.isArray(data[mf.id]) ? data[mf.id] : [];
  }

  /**
   * Lists everyone on a submission: the leader, or the single person,
   * first, then the members.
   *
   * @param {?Object} form The form.
   * @param {?Object} data The answers.
   * @return {!Array<{name: string, code: string, phone: string, section:
   *     string, leader: boolean}>} The people.
   */
  function membersOf(form, data) {
    var out = [];
    var answers = data || {};
    var name = valueByRole(form, data, 'name');
    if (name) {
      out.push({
        name: name,
        code: valueByRole(form, data, 'code') || '',
        phone: valueByRole(form, data, 'phone') || '',
        section: answers.section || '',
        leader: true
      });
    }
    memberList(form, data).forEach(function (m) {
      out.push({
        name: m.name || '',
        code: m.code || '',
        phone: m.phone || '',
        section: m.section || '',
        leader: false
      });
    });
    return out;
  }

  /**
   * Counts the different people the responses of a form hold: leaders and
   * members, a student code counted once however many responses name it.
   * A person without a code counts each time.
   *
   * @param {?Object} form The form.
   * @param {?Array<!Object>} rows The responses, each with its `data`.
   * @return {number} How many people.
   */
  function countPeople(form, rows) {
    var seen = {};
    var n = 0;
    (rows || []).forEach(function (r) {
      membersOf(form, r.data).forEach(function (m) {
        var code = String(m.code || '').trim();
        if (code && seen[code]) return;
        if (code) seen[code] = true;
        n++;
      });
    });
    return n;
  }

  /**
   * Gives the state of a form that its status alone decides.
   *
   * @param {*} status The status of the form.
   * @return {string} 'draft', 'archived' or 'closed', or '' when the dates
   *     decide.
   */
  function statusState(status) {
    if (status === FormStatus.DRAFT) return 'draft';
    if (status === FormStatus.ARCHIVED) return 'archived';
    if (status === FormStatus.CLOSED) return 'closed';
    return '';
  }

  /**
   * Gives the state of a form from the dates it opens and closes.
   *
   * @param {!Object} form The form.
   * @param {number} now The time to judge at.
   * @return {string} 'not_yet', 'closed' or 'open'.
   */
  function dateState(form, now) {
    var o = form.opensAt ? Date.parse(form.opensAt) : NaN;
    var c = form.closesAt ? Date.parse(form.closesAt) : NaN;
    if (!Number.isNaN(o) && now < o) return 'not_yet';
    if (!Number.isNaN(c) && now > c) return 'closed';
    return 'open';
  }

  /**
   * Says whether a form takes submissions now, from its status and dates.
   *
   * @param {?Object} form The form.
   * @param {?number=} nowMs The time to judge at; now when missing.
   * @return {string} 'open', 'not_yet', 'closed', 'draft' or 'archived'.
   */
  function formState(form, nowMs) {
    if (!form) return 'closed';
    var now = nowMs == null ? Date.now() : nowMs;
    return statusState(form.status) || dateState(form, now);
  }

  var api = {
    fieldByRole: fieldByRole,
    valueByRole: valueByRole,
    membersOf: membersOf,
    countPeople: countPeople,
    formState: formState
  };
  if (node) module.exports = api;
  root.RulesForm = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

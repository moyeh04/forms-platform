/**
 * The rules of a whole submission: each field checked by its type, the
 * member forms of a team, and nobody named twice.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var parts = node
    ? {
        text: require('./text.js'),
        phone: require('./phone.js'),
        codes: require('./codes.js'),
        link: require('./drive-link.js'),
        slots: require('./slots.js'),
        form: require('./form.js'),
        size: require('./team-size.js')
      }
    : {
        text: root.RulesText,
        phone: root.RulesPhone,
        codes: root.RulesCodes,
        link: root.RulesDriveLink,
        slots: root.RulesSlots,
        form: root.RulesForm,
        size: root.RulesTeamSize
      };

  /** The longest answer of a long text field. */
  var MAX_TEXTAREA_LENGTH = 2000;

  /** The longest answer of a short text field when the field does not say. */
  var MAX_TEXT_LENGTH = 200;

  /**
   * Checks a select field against its options.
   *
   * @param {!Object} field The field, with its options.
   * @param {*} raw The choice.
   * @return {!Object} `{ok: true, value}` or `{ok: false, error}`.
   */
  function validateSelect(field, raw) {
    var v = String(raw);
    var values = (field.options || []).map(function (o) {
      return String(typeof o === 'object' ? o.value : o);
    });
    if (values.indexOf(v) === -1) return { ok: false, error: 'invalid_choice' };
    return { ok: true, value: v };
  }

  /**
   * Checks a long text field.
   *
   * @param {*} raw The answer.
   * @return {!Object} `{ok: true, value}` or `{ok: false, error, params}`.
   */
  function validateTextarea(raw) {
    var v = String(raw).trim();
    if (v.length > MAX_TEXTAREA_LENGTH) {
      return {
        ok: false,
        error: 'too_long',
        params: { max: MAX_TEXTAREA_LENGTH }
      };
    }
    return { ok: true, value: v };
  }

  /**
   * Checks a short text field, the type of any field with no rule of its
   * own.
   *
   * @param {!Object} field The field, with its longest length.
   * @param {*} raw The answer.
   * @return {!Object} `{ok: true, value}` or `{ok: false, error, params}`.
   */
  function validatePlain(field, raw) {
    var v = parts.text.squash(raw);
    var max = field.max || MAX_TEXT_LENGTH;
    if (v.length > max) {
      return { ok: false, error: 'too_long', params: { max: max } };
    }
    return { ok: true, value: v };
  }

  /**
   * Checks an answer given to a field, by the type of the field.
   *
   * @param {!Object} field The field.
   * @param {*} raw The answer, not empty.
   * @param {!Object} ctx The form being filled in.
   * @return {!Object} `{ok: true, value}` or `{ok: false, error, params}`.
   */
  function checkByType(field, raw, ctx) {
    switch (field.type) {
      case 'arabic_name':
        return parts.text.validateArabicName(raw, { minParts: field.minParts });
      case 'english_text':
        return parts.text.validateEnglishText(raw, {
          min: field.min,
          max: field.max
        });
      case 'team_size':
        return parts.size.validateTeamSize(raw, ctx.form);
      case 'phone':
        return parts.phone.validatePhone(raw);
      case 'code':
        return parts.codes.validateCode(raw, { length: field.length });
      case 'email':
        return parts.text.validateEmail(raw);
      case 'drive_link':
        return parts.link.validateDriveLink(raw, { kinds: field.kinds });
      case 'select':
        return validateSelect(field, raw);
      case 'textarea':
        return validateTextarea(raw);
      default:
        return validatePlain(field, raw);
    }
  }

  /**
   * Checks one field of a submission by its type.
   *
   * @param {!Object} field The field.
   * @param {*} raw The answer.
   * @param {?Object=} ctx The form and, once the team size is known, how
   *     many members are needed (`memberCount`).
   * @return {!Object} `{ok: true, value}` with the cleaned answer, or
   *     `{ok: false, error, params, nested}`.
   */
  function validateField(field, raw, ctx) {
    var c = ctx || {};
    var t = field.type;
    if (t === 'members') return validateMembers(field, raw, c);
    if (t === 'slot') return parts.slots.validateSlot(field, raw, c);
    if (parts.text.isEmpty(raw)) {
      return field.required === false
        ? { ok: true, value: '' }
        : { ok: false, error: 'required' };
    }
    return checkByType(field, raw, c);
  }

  /**
   * Says what is wrong with the number of members a team listed.
   *
   * @param {!Object} field The members field.
   * @param {number} count The members listed.
   * @param {!Object} ctx The form and the members needed, when known.
   * @return {?Object} `{ok: false, error, params}`, or null when it is right.
   */
  function countProblem(field, count, ctx) {
    if (ctx.memberCount != null) {
      // The team size the person chose decides exactly how many are needed.
      if (count === ctx.memberCount) return null;
      return {
        ok: false,
        error: 'members_count',
        params: { count: ctx.memberCount }
      };
    }
    var range = parts.size.teamSizeRange(ctx.form);
    var min = field.min == null ? range.min - 1 : field.min;
    var max = field.max == null ? range.max - 1 : field.max;
    if (count < min) {
      return { ok: false, error: 'too_few_members', params: { min: min } };
    }
    if (count > max) {
      return { ok: false, error: 'too_many_members', params: { max: max } };
    }
    return null;
  }

  /**
   * Checks the member forms of a team, each field of each member.
   *
   * @param {!Object} field The members field, with the fields of a member.
   * @param {*} raw The members as typed.
   * @param {!Object} ctx The form and the members needed, when known.
   * @return {!Object} `{ok: true, value}` with the cleaned members, or
   *     `{ok: false, error, params, nested}`.
   */
  function validateMembers(field, raw, ctx) {
    var list = Array.isArray(raw) ? raw : [];
    var problem = countProblem(field, list.length, ctx);
    if (problem) return problem;
    var errors = {};
    var clean = list.map(function (m, i) {
      var row = {};
      (field.fields || []).forEach(function (sf) {
        if (sf.enabled === false) return;
        var r = validateField(sf, m ? m[sf.id] : undefined, ctx);
        if (r.ok) row[sf.id] = r.value;
        else errors[i + '.' + sf.id] = { error: r.error, params: r.params };
      });
      return row;
    });
    if (Object.keys(errors).length) {
      return { ok: false, error: 'members_invalid', nested: errors };
    }
    return { ok: true, value: clean };
  }

  /**
   * Marks each member whose code was named before on the same submission.
   *
   * @param {!Object} form The form.
   * @param {!Object} out The cleaned answers, by field id.
   * @param {!Object} errors The errors so far, by field id; it gains the
   *     duplicates.
   */
  function markDuplicateCodes(form, out, errors) {
    var codeField = parts.form.fieldByRole(form, 'code');
    var membersField = parts.form.fieldByRole(form, 'members');
    if (!codeField || !membersField || errors[membersField.id]) return;
    var list = out[membersField.id];
    var codeSub = (membersField.fields || []).filter(function (sf) {
      return sf.role === 'code';
    })[0];
    if (!Array.isArray(list) || !codeSub) return;
    var seen = {};
    if (out[codeField.id]) seen[out[codeField.id]] = true;
    list.forEach(function (m, i) {
      var c = m[codeSub.id];
      var e = errors[membersField.id];
      if (!c) return;
      if (seen[c]) {
        e = e || { error: 'members_invalid', nested: {} };
        e.nested[i + '.' + codeSub.id] = { error: 'duplicate_code' };
        errors[membersField.id] = e;
      }
      seen[c] = true;
    });
  }

  /**
   * Gives how many member forms the chosen team size asks for.
   *
   * @param {!Object} sizeField The team size field.
   * @param {!Object} answers The answers, by field id.
   * @param {!Object} ctx The form being filled in.
   * @return {?number} The members, the leader left out, or null when the
   *     size is not valid.
   */
  function membersNeeded(sizeField, answers, ctx) {
    var sz = validateField(sizeField, answers[sizeField.id], ctx);
    return sz.ok ? parseInt(sz.value, 10) - 1 : null;
  }

  /**
   * Validates a whole submission against a form definition. The chosen
   * team size fixes how many member forms must be filled in, and nobody may
   * appear twice in the same submission.
   *
   * @param {!Object} form The form.
   * @param {?Object} data The answers, by field id.
   * @param {?Object=} ctx Extra context; it gains the form and the members
   *     needed.
   * @return {{ok: boolean, errors: !Object, data: !Object}} Whether it
   *     passed, the error of each field (`{error, params, nested}`) and the
   *     cleaned answers.
   */
  function validateSubmission(form, data, ctx) {
    var c = ctx || {};
    var answers = data || {};
    c.form = form;
    c.memberCount = null;
    var out = {};
    var errors = {};
    var sizeField = parts.form.fieldByRole(form, 'team_size');
    var hasSize = !!sizeField && sizeField.enabled !== false;
    if (hasSize) c.memberCount = membersNeeded(sizeField, answers, c);
    (form.fields || []).forEach(function (f) {
      if (f.enabled === false) return;
      if (f.type === 'members' && hasSize && c.memberCount == null) return;
      var r = validateField(f, answers[f.id], c);
      if (r.ok) out[f.id] = r.value;
      else
        errors[f.id] = { error: r.error, params: r.params, nested: r.nested };
    });
    markDuplicateCodes(form, out, errors);
    return { ok: Object.keys(errors).length === 0, errors: errors, data: out };
  }

  var api = {
    validateField: validateField,
    validateSubmission: validateSubmission
  };
  if (node) module.exports = api;
  root.RulesSubmission = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

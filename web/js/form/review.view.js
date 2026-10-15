/**
 * The review step: every answer as it will be sent, grouped by step, and the
 * summary on the ticket.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var L = P.L;
  var S = P.S;

  /** The roles of the questions the ticket repeats. */
  var TICKET_ROLES = ['name', 'code', 'team_size', 'title', 'slot'];

  /**
   * Gives the label of a picked choice.
   *
   * @param {!Object} field The question.
   * @param {*} value The answer.
   * @return {*} The label, or the answer itself.
   */
  function optionLabel(field, value) {
    var o = (field.options || []).filter(function (x) {
      return String(x.value) === String(value);
    })[0];
    return o ? L(o.label) : value;
  }

  /**
   * Says whether an answer is empty.
   *
   * @param {*} value The answer.
   * @return {boolean} True for nothing, '' or an empty list.
   */
  function isEmpty(value) {
    if (value === undefined || value === null || value === '') return true;
    return Array.isArray(value) && !value.length;
  }

  /**
   * Writes a booked slot. A day and a time keep their order inside an
   * Arabic page.
   *
   * @param {!Object} value The slot, as `{day, time}`.
   * @return {!Element} The text.
   */
  function slotValue(value) {
    var slots = S.form.slots || {};
    var day = (slots.days || []).filter(function (d) {
      return d.id === value.day;
    })[0];
    return P.ltr((day ? day.label : value.day) + ' - ' + value.time);
  }

  /**
   * Draws the members of a team, with the note of their number.
   *
   * @param {!Array<!Object>} value The members.
   * @return {!Element} The list.
   */
  function membersValue(value) {
    var people = h(
      'ul',
      { class: 'plain' },
      value.map(function (m) {
        return h(
          'li',
          { class: 'person' },
          h('bdi', null, m.name || ''),
          m.code ? h('span', { class: 'code' }, m.code) : null
        );
      })
    );
    var mates = P.sizeField()
      ? ''
      : Rules.teammateNotice(S.form, value.length, App.i18n.lang);
    return P.withNote(people, mates);
  }

  /**
   * Writes an answer as the review shows it.
   *
   * @param {!Object} field The question.
   * @param {*} value The answer.
   * @return {*} Text or a node; '-' when there is no answer.
   */
  function displayValue(field, value) {
    if (isEmpty(value)) return '-';
    switch (field.type) {
      case 'select':
        return optionLabel(field, value);
      case 'slot':
        return slotValue(value);
      case 'members':
        return membersValue(value);
      case 'code':
        return h('span', { class: 'code' }, value);
      case 'team_size':
        return P.withNote(
          String(value),
          Rules.teamSizeNotice(S.form, value, App.i18n.lang)
        );
      default:
        return String(value);
    }
  }

  /**
   * Draws the teammates a key booking's team has.
   *
   * @param {!Array<string>} mates Their names.
   * @return {!Element} The list.
   */
  function matesList(mates) {
    return h(
      'ul',
      { class: 'plain' },
      mates.map(function (n) {
        return h('li', { class: 'person' }, h('bdi', null, n));
      })
    );
  }

  /**
   * Lists what is known of the team of a key booking.
   *
   * @return {!Array<!Array<*>>} Rows of a label and a value.
   */
  function teamRows() {
    var rows = [
      [t('teamLeader'), S.team.leader],
      [t('teamCode'), S.team.code]
    ];
    if (S.team.title) rows.push([t('teamProject'), S.team.title]);
    rows.push([
      t('teamPeople'),
      S.team.size > 1 ? t('teamPeopleN', { n: S.team.size }) : t('teamSolo')
    ]);
    var mates = S.team.teammates || [];
    if (mates.length) rows.push([t('teamMates'), matesList(mates)]);
    return rows;
  }

  /**
   * Draws the team of a key booking.
   *
   * @return {!Element} The list.
   */
  function teamSummary() {
    return h(
      'dl',
      { class: 'summary' },
      teamRows().map(function (r) {
        return [h('dt', null, r[0]), h('dd', null, r[1])];
      })
    );
  }

  /**
   * Draws the answers of a step.
   *
   * @param {!Object} step The step.
   * @return {!Element} The list.
   */
  function summaryList(step) {
    if (step.team) return teamSummary();
    var rows = [];
    step.fields.forEach(function (f) {
      rows.push(
        h('dt', null, L(f.label)),
        h('dd', null, displayValue(f, S.data[f.id]))
      );
    });
    return h('dl', { class: 'summary' }, rows);
  }

  /**
   * Draws the answers of a step on the review, with a button that goes
   * back to it when it may change.
   *
   * @param {!Object} s The step.
   * @return {!Element} The block.
   */
  function reviewGroup(s) {
    var i = S.steps.indexOf(s);
    var canChange = !P.slotOnly() || s.fields.indexOf(P.slotField()) !== -1;
    var change = canChange
      ? h(
          'button',
          {
            type: 'button',
            class: 'link-btn',
            onclick: function () {
              P.go(i);
            }
          },
          t('change')
        )
      : null;
    return h(
      'div',
      { class: 'review-group' },
      h(
        'div',
        { class: 'member-head' },
        h('h3', { class: 'member-title' }, P.stepTitle(s)),
        change
      ),
      summaryList(s)
    );
  }

  /**
   * Draws the review step: the answers of every other step.
   *
   * @return {!Array<!Element>} A block per step.
   */
  function reviewBody() {
    return S.steps
      .filter(function (s) {
        return !s.review;
      })
      .map(reviewGroup);
  }

  /**
   * Lists a question and its answer for the ticket.
   *
   * @param {!Object} f The question.
   * @return {{label: string, value: *}} The row.
   */
  function ticketRow(f) {
    return { label: L(f.label), value: displayValue(f, S.data[f.id]) };
  }

  /**
   * Lists the rows of the ticket of a key booking: the team and the slot.
   *
   * @return {!Array<{label: string, value: *}>} The rows.
   */
  function keyTicketRows() {
    var rows = teamRows().map(function (r) {
      return { label: r[0], value: r[1] };
    });
    rows.push(ticketRow(P.slotField()));
    return rows;
  }

  /**
   * Lists the answers the ticket repeats: the main questions, then the
   * members.
   *
   * @return {!Array<{label: string, value: *}>} The rows.
   */
  function ticketSummary() {
    if (S.team && S.form.keyBooking && S.mode === 'new') {
      return keyTicketRows();
    }
    var rows = S.form.fields
      .filter(function (f) {
        return f.enabled !== false && TICKET_ROLES.indexOf(f.role) !== -1;
      })
      .map(ticketRow);
    var mf = Rules.fieldByRole(S.form, 'members');
    var members = mf ? S.data[mf.id] : null;
    if (Array.isArray(members) && members.length) rows.push(ticketRow(mf));
    return rows;
  }

  P.reviewBody = reviewBody;
  P.displayValue = displayValue;
  P.teamSummary = teamSummary;
  P.summaryList = summaryList;
  P.ticketSummary = ticketSummary;
})(window.App);

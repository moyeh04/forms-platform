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

  function optionLabel(field, value) {
    var o = (field.options || []).filter(function (x) {
      return String(x.value) === String(value);
    })[0];
    return o ? L(o.label) : value;
  }

  function displayValue(field, value) {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && !value.length)
    )
      return '-';
    if (field.type === 'select') return optionLabel(field, value);
    if (field.type === 'slot') {
      var day = ((S.form.slots && S.form.slots.days) || []).filter(
        function (d) {
          return d.id === value.day;
        }
      )[0];
      // A day and a time keep their order inside an Arabic page.
      return P.ltr((day ? day.label : value.day) + ' - ' + value.time);
    }
    if (field.type === 'members') {
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
    if (field.type === 'code') return h('span', { class: 'code' }, value);
    if (field.type === 'team_size') {
      var note = Rules.teamSizeNotice(S.form, value, App.i18n.lang);
      return P.withNote(String(value), note);
    }
    return String(value);
  }

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
    if (mates.length)
      rows.push([
        t('teamMates'),
        h(
          'ul',
          { class: 'plain' },
          mates.map(function (n) {
            return h('li', { class: 'person' }, h('bdi', null, n));
          })
        )
      ]);
    return rows;
  }

  function teamSummary() {
    return h(
      'dl',
      { class: 'summary' },
      teamRows().map(function (r) {
        return [h('dt', null, r[0]), h('dd', null, r[1])];
      })
    );
  }

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

  function reviewBody() {
    return S.steps
      .filter(function (s) {
        return !s.review;
      })
      .map(function (s) {
        var i = S.steps.indexOf(s);
        var canChange = !P.slotOnly() || s.fields.indexOf(P.slotField()) !== -1;
        return h(
          'div',
          { class: 'review-group' },
          h(
            'div',
            { class: 'member-head' },
            h('h3', { class: 'member-title' }, P.stepTitle(s)),
            canChange
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
              : null
          ),
          summaryList(s)
        );
      });
  }

  function ticketSummary() {
    var rows = [];
    if (S.team && S.form.keyBooking && S.mode === 'new') {
      teamRows().forEach(function (r) {
        rows.push({ label: r[0], value: r[1] });
      });
      var sf = P.slotField();
      rows.push({ label: L(sf.label), value: displayValue(sf, S.data[sf.id]) });
      return rows;
    }
    S.form.fields
      .filter(function (f) {
        return (
          f.enabled !== false &&
          ['name', 'code', 'team_size', 'title', 'slot'].indexOf(f.role) !== -1
        );
      })
      .forEach(function (f) {
        rows.push({ label: L(f.label), value: displayValue(f, S.data[f.id]) });
      });
    var mf = Rules.fieldByRole(S.form, 'members');
    if (mf && Array.isArray(S.data[mf.id]) && S.data[mf.id].length)
      rows.push({ label: L(mf.label), value: displayValue(mf, S.data[mf.id]) });
    return rows;
  }

  P.reviewBody = reviewBody;
  P.displayValue = displayValue;
  P.teamSummary = teamSummary;
  P.summaryList = summaryList;
  P.ticketSummary = ticketSummary;
})(window.App);

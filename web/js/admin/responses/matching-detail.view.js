/**
 * The right side of WhatsApp matching: the chosen request, every
 * registration with its phone number and timetable, a note, and the
 * buttons that decide.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var Rules = window.Rules;
  var ui = App.ui;
  var h = ui.h;
  var icon = ui.icon;

  /**
   * Draws the details of a registration, with its review steps.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The registration.
   * @return {!Element} The list of details.
   */
  function registrationDetails(form, s) {
    var d = s.data;
    return h(
      'dl',
      null,
      h('dt', null, 'Name'),
      h('dd', null, R.bdi(s.name)),
      h('dt', null, 'Code'),
      h('dd', { class: 'mono' }, s.code),
      h('dt', null, 'Level'),
      h('dd', null, d.level || ''),
      h('dt', null, 'Major'),
      h('dd', null, d.major || ''),
      h('dt', null, 'Group and section'),
      h('dd', null, (d.group || '') + ' / ' + (d.section || '')),
      (form.review?.steps || []).map(function (st) {
        return [
          h('dt', null, st.label.en),
          h('dd', null, R.reviewSelect(form, s, st))
        ];
      })
    );
  }

  /**
   * Draws the timetable of a registration from Drive, when its link is a
   * Drive file.
   *
   * @param {!Object} s The registration.
   * @return {!Array<!Element>} The link and the preview, or nothing.
   */
  function timetable(s) {
    var p = s.link ? Rules.parseDriveLink(s.link) : { ok: false };
    if (!p.ok) return [];
    return [
      h(
        'div',
        { class: 'actions', style: { marginBottom: '8px' } },
        h(
          'a',
          {
            class: 'btn btn-quiet sm',
            href: s.link,
            target: '_blank',
            rel: 'noopener'
          },
          'Open timetable in Drive'
        )
      ),
      h('iframe', {
        class: 'preview',
        src: 'https://drive.google.com/file/d/' + p.id + '/preview',
        title: 'Timetable screenshot of ' + s.name,
        loading: 'lazy'
      })
    ];
  }

  /**
   * Draws what the registrations of a phone number need said: none, or
   * more than one.
   *
   * @param {number} n How many registrations use the number.
   * @return {?Element} The line, or null for exactly one.
   */
  function matchNote(n) {
    if (!n) {
      return h(
        'p',
        null,
        'No registration uses this phone number. Ask the student to' +
          ' register, or check that they used the same number in WhatsApp.'
      );
    }
    if (n > 1) {
      return h(
        'p',
        { class: 'banner info' },
        'More than one registration uses this number. Check them below' +
          ' before deciding.'
      );
    }
    return null;
  }

  /**
   * Draws a button that waits for its action.
   *
   * @param {string} cls Its class.
   * @param {string} name Its name.
   * @param {!Array<*>} content Its icon and text.
   * @param {function(): !Promise} act What it does.
   * @return {!Element} The button.
   */
  function actButton(cls, name, content, act) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn ' + cls,
        name: name,
        onclick: function (e) {
          A.busy(e.currentTarget, act);
        }
      },
      content
    );
  }

  /**
   * Removes a request from the list.
   *
   * @param {!Object} m The matching state.
   * @param {!Object} q The request.
   * @return {!Promise} Settles once it is removed and drawn.
   */
  async function removeRequest(m, q) {
    await A.call('admin.matching.remove', {
      slug: m.form.slug,
      requestIds: [q.id]
    });
    ui.toast('Removed from the list', 'ok');
    await m.load(false);
  }

  /**
   * Draws the buttons that decide a request, and the one that removes it.
   *
   * @param {!Object} m The matching state.
   * @param {!Object} q The request.
   * @return {!Element} The row.
   */
  function decisionRow(m, q) {
    var decide = R.decideMatch.bind(null, m, q);
    return h(
      'div',
      { class: 'actions' },
      actButton(
        'btn-primary',
        'approve',
        [icon('check', A.ICON_SIZE.BUTTON), 'Approve'],
        decide.bind(null, 'approved')
      ),
      actButton(
        'btn-danger',
        'reject',
        [icon('x', A.ICON_SIZE.BUTTON), 'Reject'],
        decide.bind(null, 'rejected')
      ),
      actButton(
        'btn-quiet',
        'pending',
        ['Back to pending'],
        decide.bind(null, 'pending')
      ),
      actButton(
        'btn-quiet',
        'remove',
        [icon('trash', A.ICON_SIZE.LINE), 'Remove from list'],
        removeRequest.bind(null, m, q)
      )
    );
  }

  /**
   * Draws the chosen request with its registrations.
   *
   * @param {!Object} m The matching state.
   * @param {!Object} q The request.
   * @return {!Array<?Element>} The parts.
   */
  function requestDetail(m, q) {
    var matches = q.matches
      .map(function (id) {
        return R.matchedSub(m, id);
      })
      .filter(Boolean);
    var note = A.text(
      m.note,
      function (v) {
        m.note = v;
      },
      { name: 'note', placeholder: 'Note (optional)' }
    );
    var parts = [
      h('h2', null, q.label ? R.bdi(q.label) : q.phone),
      h(
        'div',
        { class: 'actions', style: { marginBottom: '12px' } },
        h('span', { class: 'mono' }, q.phone),
        R.matchBadges(q)
      ),
      matchNote(matches.length)
    ];
    matches.forEach(function (s) {
      parts = parts.concat(registrationDetails(m.form, s), timetable(s));
    });
    return parts.concat(
      h('div', { style: { marginTop: '14px' } }, A.field('Note', note)),
      decisionRow(m, q),
      q.note ? h('p', { class: 'muted-note' }, 'Saved note: ' + q.note) : null
    );
  }

  /**
   * Draws the right side again.
   *
   * @param {!Object} m The matching state.
   */
  R.paintMatchDetail = function (m) {
    var right = m.right;
    var q = m.data.requests.filter(function (r) {
      return r.id === m.sel;
    })[0];
    ui.clear(right);
    if (!q) {
      right.appendChild(
        h(
          'div',
          { class: 'empty' },
          "Choose a request from the list to see the student's registration" +
            ' and timetable.'
        )
      );
      return;
    }
    requestDetail(m, q).forEach(function (node) {
      if (node) right.appendChild(node);
    });
  };
})(window.App);

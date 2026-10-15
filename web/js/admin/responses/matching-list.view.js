/**
 * The left side of WhatsApp matching: the box the requests are pasted
 * into, the filters with their counts, and the list of requests.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;

  /** The filters, in order: a match status or a decision. */
  var FILTERS = [
    ['all', 'All'],
    ['pending', 'Pending'],
    ['matched', 'Matched'],
    ['none', 'No match'],
    ['duplicate', 'Duplicate'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected']
  ];

  /**
   * Says what an import added.
   *
   * @param {!Object} r What the server answered.
   * @return {string} The message.
   */
  function importText(r) {
    return (
      'Added ' +
      r.added +
      (r.duplicates ? ', ' + r.duplicates + ' already in the list' : '') +
      (r.unparsed.length
        ? ', ' + r.unparsed.length + ' line(s) had no phone number'
        : '')
    );
  }

  /**
   * Draws the box the requests are pasted into, and its button.
   *
   * @param {!Object} m The matching state.
   * @return {!Array<!Element>} The box and its button row.
   */
  function pasteBox(m) {
    var ta = h('textarea', {
      class: 'textarea',
      rows: '5',
      name: 'paste',
      placeholder:
        'Paste the pending WhatsApp requests here.\n' +
        'One per line, each with the phone number.',
      dir: 'ltr',
      'aria-label': 'Pasted WhatsApp requests'
    });
    var addBtn = h(
      'button',
      { type: 'button', class: 'btn btn-primary sm', name: 'import' },
      'Add to the list'
    );
    addBtn.addEventListener('click', function () {
      A.busy(addBtn, async function () {
        var r = await A.call('admin.matching.import', {
          slug: m.form.slug,
          text: ta.value
        });
        ui.toast(importText(r), r.added ? 'ok' : 'err');
        await m.load(true);
      });
    });
    return [
      ta,
      h('div', { class: 'actions', style: { marginTop: '8px' } }, addBtn)
    ];
  }

  /**
   * Counts the requests under each filter.
   *
   * @param {!Array<!Object>} requests The requests.
   * @return {!Object<string, number>} The count of each filter.
   */
  function countsOf(requests) {
    var counts = { all: requests.length };
    ['matched', 'none', 'duplicate'].forEach(function (k) {
      counts[k] = requests.filter(function (r) {
        return r.status === k;
      }).length;
    });
    ['pending', 'approved', 'rejected'].forEach(function (k) {
      counts[k] = requests.filter(function (r) {
        return r.decision === k;
      }).length;
    });
    return counts;
  }

  /**
   * Draws the filter buttons with their counts.
   *
   * @param {!Object} m The matching state.
   * @return {!Element} The row of buttons.
   */
  function filterRow(m) {
    var counts = countsOf(m.data.requests);
    return h(
      'div',
      { class: 'actions', style: { marginTop: '14px' } },
      FILTERS.map(function (f) {
        var on = m.filter === f[0];
        return h(
          'button',
          {
            type: 'button',
            class: 'btn sm ' + (on ? 'btn-primary' : 'btn-quiet'),
            dataset: { filter: f[0] },
            'aria-pressed': on ? 'true' : 'false',
            onclick: function () {
              m.filter = f[0];
              m.paint();
            }
          },
          f[1] + ' (' + counts[f[0]] + ')'
        );
      })
    );
  }

  /**
   * Draws a request as a button that chooses it.
   *
   * @param {!Object} m The matching state.
   * @param {!Object} r The request.
   * @return {!Element} The button.
   */
  function requestButton(m, r) {
    return h(
      'button',
      {
        type: 'button',
        class: 'req',
        dataset: { id: r.id },
        'aria-pressed': m.sel === r.id ? 'true' : 'false',
        onclick: function () {
          m.sel = r.id;
          m.paint();
        }
      },
      h('span', null, r.label ? R.bdi(r.label) : '(no name)'),
      h('span', { class: 'mono' }, r.phone),
      h('span', { class: 'req-badges' }, R.matchBadges(r))
    );
  }

  /**
   * Draws the requests of the filter, or why there are none.
   *
   * @param {!Object} m The matching state.
   * @return {!Element} The list.
   */
  function requestList(m) {
    var list = R.visibleRequests(m).map(requestButton.bind(null, m));
    if (list.length) return h('div', { class: 'req-list' }, list);
    return h(
      'div',
      { class: 'empty', style: { marginTop: '10px' } },
      m.data.requests.length
        ? 'No requests in this filter.'
        : 'No requests yet. Paste the list above.'
    );
  }

  /**
   * Draws the left side again.
   *
   * @param {!Object} m The matching state.
   */
  R.paintMatchList = function (m) {
    var left = m.left;
    var waiting = m.data.notRequested.length;
    ui.clear(left);
    left.appendChild(h('h2', null, 'WhatsApp requests'));
    left.appendChild(
      h(
        'p',
        { class: 'help' },
        'WhatsApp does not let websites read join requests, so paste them' +
          ' here. Each phone number is matched to what the student submitted.'
      )
    );
    pasteBox(m).forEach(function (node) {
      left.appendChild(node);
    });
    left.appendChild(filterRow(m));
    left.appendChild(requestList(m));
    if (waiting) {
      left.appendChild(
        h(
          'p',
          { class: 'muted-note', style: { marginTop: '12px' } },
          waiting + ' registration(s) have no matching WhatsApp request yet.'
        )
      );
    }
  };
})(window.App);

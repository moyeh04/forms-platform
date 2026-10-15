/**
 * The Booking with a key panel of a reservation: teams that already
 * registered type the key from their registration instead of their
 * details.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;

  /** What booking with a key does, in the words of the page. */
  var HOW = [
    'Name, code, phone and every other question the two forms share are' +
      ' copied from the registration. Students are not asked them again.',
    'The Questions section below still decides which answers are kept and' +
      ' shown.',
    'The same key opens and cancels the booking. A key that has expired for' +
      ' editing still books.',
    'Each team books once.'
  ];

  /**
   * Draws the choice of the registration form whose keys book.
   *
   * @param {!Object} k The panel: `f` and `sources`.
   * @return {!Element} The field.
   */
  function sourceField(k) {
    var kb = k.f.keyBooking;
    var pick = A.select(
      kb.source,
      k.sources.map(function (s) {
        return [s.id, s.title + (s.term ? ' (' + s.term + ')' : '')];
      }),
      function (v) {
        kb.source = v;
      }
    );
    pick.name = 'keySource';
    return A.field(
      'Registration form',
      pick,
      'The student types the 5-digit key from that form, checks the team' +
        ' shown, and picks a slot.'
    );
  }

  /**
   * Draws the panel's body again. Without a form that issues keys there is
   * nothing to switch on, so the switch is not shown. A source that no
   * longer gives keys is replaced by the first one that does.
   *
   * @param {!Object} k The panel: `f`, `sources` and `body`.
   */
  function paint(k) {
    var kb = k.f.keyBooking;
    ui.clear(k.body);
    if (!k.sources.length) {
      k.body.appendChild(
        h(
          'p',
          { class: 'muted-note' },
          'No form gives its students a key yet. Create a team registration' +
            ' form first, then come back here.'
        )
      );
      return;
    }
    var known = k.sources.some(function (s) {
      return s.id === kb.source;
    });
    k.body.appendChild(
      A.check(
        'Students book with the key from their registration',
        kb.enabled,
        function (v) {
          kb.enabled = v;
          if (v && !known) kb.source = k.sources[0].id;
          paint(k);
        },
        { name: 'keyBooking' }
      )
    );
    if (!kb.enabled) return;
    if (!known) {
      k.body.appendChild(
        h(
          'p',
          { class: 'error', role: 'alert' },
          'The registration form this used no longer gives keys. Choose' +
            ' another one.'
        )
      );
      kb.source = k.sources[0].id;
    }
    k.body.appendChild(sourceField(k));
    k.body.appendChild(
      h(
        'ul',
        { class: 'help plain-list' },
        HOW.map(function (line) {
          return h('li', null, line);
        })
      )
    );
  }

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} k The panel.
   * @return {string} Off, or on with the form whose keys book.
   */
  function summary(k) {
    var kb = k.f.keyBooking;
    if (!kb.enabled) return 'Off';
    var from = k.sources.filter(function (x) {
      return x.id === kb.source;
    })[0];
    return 'On' + (from ? ', keys of ' + from.title : ', no form chosen');
  }

  /**
   * Draws the Booking with a key panel. f.keyBooking is filled in.
   *
   * @param {!Object} s The settings page: `f`, and `res.keySources`, the
   *     forms that give keys.
   * @return {!Element} The panel.
   */
  A.keyBookingPanel = function (s) {
    s.f.keyBooking = s.f.keyBooking || { enabled: false, source: '' };
    var k = { f: s.f, sources: s.res.keySources || [], body: h('div') };
    paint(k);
    var panel = A.panel(
      'Booking with a key',
      'Let teams that already registered book a slot without typing their' +
        ' details again.',
      k.body
    );
    panel.summary = summary.bind(null, k);
    return panel;
  };
})(window.App);

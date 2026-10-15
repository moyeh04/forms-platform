/**
 * The teammates of a booking: whether they are asked, how many, the words
 * students read, and what is asked about each one.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var Q = A.questions;
  var h = App.ui.h;

  /** How many teammates come with the leader: the defaults and bounds. */
  var TEAMMATES = { MIN: 1, MAX: 5, FLOOR: 0, CEILING: 19 };

  var WORDS = {
    name: 'The number of teammates',
    min: 'Fewest teammates',
    max: 'Most teammates',
    choose: 'A leader can bring',
    unit: 'teammates',
    who: 'A leader who brings',
    one: 'saved booking',
    many: 'saved bookings',
    stay: 'booked',
    fix: 'to change their teammates',
    note: 'Note for some numbers of teammates',
    noteFor: 'Show the note for bookings with',
    noteHelp:
      'Show a short note when a leader adds one of the numbers of teammates' +
      ' you switch on, for example to say that other students may join a' +
      ' small team.',
    placeholder: {
      en: 'Other students may join your team, up to {max} teammates.',
      ar: 'ممكن طلاب تانيين ينضموا لفريقك، لحد {max}.'
    }
  };

  /**
   * Fills in what the teammates question is missing and reads its range
   * as numbers.
   *
   * @param {!Object} tm The teammates question, changed in place.
   */
  function settle(tm) {
    tm.min = tm.min == null ? TEAMMATES.MIN : parseInt(tm.min, 10) || 0;
    var max = tm.max == null ? TEAMMATES.MAX : parseInt(tm.max, 10) || 1;
    tm.max = Math.max(max, tm.min, 1);
    tm.label = tm.label || { en: 'Teammates', ar: 'أعضاء الفريق' };
    tm.help = tm.help || { en: '', ar: '' };
  }

  /**
   * Draws a text of the teammates in one language.
   *
   * @param {!Object} text The text: `en` and `ar`, changed in place.
   * @param {string} lang 'en' or 'ar'.
   * @param {string} name The name of the input.
   * @param {boolean} long True for a textarea.
   * @return {!Element} The input.
   */
  function textIn(text, lang, name, long) {
    var ar = lang === 'ar';
    var attrs = {
      name: name,
      dir: ar ? 'rtl' : null,
      lang: ar ? 'ar' : null
    };
    if (!long) {
      return A.text(
        text[lang],
        function (v) {
          text[lang] = v;
        },
        attrs
      );
    }
    return h(
      'textarea',
      Object.assign(attrs, {
        class: 'textarea',
        rows: '2',
        oninput: function (e) {
          text[lang] = e.target.value;
        }
      }),
      text[lang] || ''
    );
  }

  /**
   * Draws the title and the line students read above the teammates.
   *
   * @param {!Object} tm The teammates question.
   * @return {!Element} The box.
   */
  function wordsBox(tm) {
    return h(
      'div',
      { class: 'subpanel' },
      h('h3', null, 'What students read'),
      h(
        'p',
        { class: 'help' },
        'The title above the teammates and the line under it.'
      ),
      h(
        'div',
        { class: 'desc-pair' },
        A.field(
          'Title in English',
          textIn(tm.label, 'en', 'teammates-title-en', false)
        ),
        A.field(
          'Title in Arabic',
          textIn(tm.label, 'ar', 'teammates-title-ar', false)
        )
      ),
      h(
        'div',
        { class: 'desc-pair' },
        A.field(
          'Line under it, in English',
          textIn(tm.help, 'en', 'teammates-help-en', true)
        ),
        A.field(
          'Line under it, in Arabic',
          textIn(tm.help, 'ar', 'teammates-help-ar', true)
        )
      )
    );
  }

  /**
   * Draws what is asked about each teammate, with the same row as every
   * other question.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} tm The teammates question.
   * @return {!Element} The box.
   */
  function askedBox(s, tm) {
    var rows = [];
    (tm.fields || []).forEach(function (sf) {
      rows = rows.concat(Q.rows(s, sf, true));
    });
    return h(
      'div',
      { class: 'subpanel' },
      h('h3', null, 'Asked about each teammate'),
      h(
        'p',
        { class: 'help' },
        'Hide what you do not need, or make it optional. The name and the' +
          ' code are always asked, because the lists and the duplicate check' +
          ' use them.'
      ),
      h('div', { class: 'q-list tm-questions' }, rows.filter(Boolean))
    );
  }

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} tm The teammates question.
   * @return {string} How many come and how much is asked about each.
   */
  function summary(tm) {
    if (tm.enabled === false) return 'Not asked';
    var asked = (tm.fields || []).filter(function (sf) {
      return sf.enabled !== false;
    }).length;
    var count =
      String(tm.min) === String(tm.max)
        ? String(tm.max)
        : tm.min + ' to ' + tm.max;
    return (
      count +
      ' with the leader, ' +
      A.plural(asked, 'detail', 'details') +
      ' each'
    );
  }

  /**
   * Draws the Teammates panel of a booking.
   *
   * @param {!Object} s The settings page: `members` is the teammates
   *     question, `res.teammateCounts` the saved bookings by count.
   * @return {{panel: !Element, range: !Object}} The panel, and the range
   *     control, asked whether the range can be saved.
   */
  A.teammatesPanel = function (s) {
    var tm = s.members;
    settle(tm);
    // How many teammates is a range like the team size, and is set with the
    // same control.
    var range = A.sizeRange(tm, {
      floor: TEAMMATES.FLOOR,
      ceiling: TEAMMATES.CEILING,
      counts: s.res.teammateCounts,
      names: {
        min: 'teammatesMin',
        max: 'teammatesMax',
        outside: 'teammates-conflicts',
        note: 'teammates-'
      },
      words: WORDS
    });
    var body = h(
      'div',
      { class: 'tm-body l-stack', hidden: tm.enabled === false },
      h(
        'p',
        { class: 'help' },
        'Teammates do not count the leader. Set the fewest to 0 when a leader' +
          ' may book alone.'
      ),
      range.node,
      wordsBox(tm),
      askedBox(s, tm)
    );
    var panel = A.panel(
      'Teammates',
      'The other people who come with the team leader. Decide whether a' +
        ' booking asks for them, how many, and what is asked about each one.',
      A.check(
        'Ask for teammates',
        tm.enabled !== false,
        function (enabled) {
          tm.enabled = enabled;
          body.hidden = enabled === false;
        },
        { name: 'reservation-members' }
      ),
      body
    );
    panel.summary = summary.bind(null, tm);
    return { panel: panel, range: range };
  };
})(window.App);

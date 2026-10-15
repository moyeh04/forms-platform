/**
 * The note of a range control: the numbers that show it, its text in
 * English and Arabic, and how a student who picks one of them sees it.
 * The control is the object range.view.js makes: `o`, `notice`,
 * `noteChips`, `notePreview` and `paint()`.
 */
(function (App) {
  'use strict';

  var ui = App.ui,
    h = ui.h,
    icon = ui.icon,
    A = App.admin;

  /**
   * Draws the chip that shows the note to students who pick a number.
   *
   * @param {!Object} c The control.
   * @param {number} n The number.
   * @return {!Element} The chip.
   */
  function noteChip(c, n) {
    var notice = c.notice;
    var on = notice.sizes.indexOf(n) !== -1;

    /** Adds the number to the note, or takes it out. */
    function toggle() {
      notice.sizes = on
        ? notice.sizes.filter(function (x) {
            return x !== n;
          })
        : notice.sizes.concat([n]).sort(function (a, z) {
            return a - z;
          });
      c.paint();
    }

    return h(
      'button',
      {
        type: 'button',
        class: 'toggle-chip',
        name: c.o.names.note + 'notice-size-' + n,
        'aria-pressed': on ? 'true' : 'false',
        onclick: toggle
      },
      String(n)
    );
  }

  /**
   * Shows the note as a student with the first picked number sees it, or
   * what is still missing.
   *
   * @param {!Object} c The control.
   * @param {{min: number, max: number}} b The bounds.
   * @return {!Element} The preview.
   */
  function notePreviewOf(c, b) {
    var w = c.o.words;
    var notice = c.notice;
    if (!notice.sizes.length) {
      return h(
        'span',
        { class: 'muted-note' },
        'Pick one or more numbers above to show the note.'
      );
    }
    var sample = notice.sizes[0];
    var text = Rules.sizeNotice(notice, sample, b.max, 'en');
    if (!text) {
      return h('span', { class: 'muted-note' }, 'Write the note below.');
    }
    return h(
      'div',
      null,
      h(
        'span',
        { class: 'muted-note' },
        w.who + ' ' + sample + (w.unit ? ' ' + w.unit : '') + ' sees:'
      ),
      h(
        'p',
        { class: 'size-notice' },
        icon('info', A.ICON_SIZE.LINE),
        h('span', null, text)
      )
    );
  }

  /**
   * Draws the note's chips and its preview. Numbers the range no longer
   * holds are taken out of the note.
   *
   * @param {!Object} c The control.
   * @param {?{min: number, max: number}} b The bounds; null while they
   *     are refused, which leaves the note empty.
   */
  A.paintRangeNote = function (c, b) {
    ui.clear(c.noteChips);
    ui.clear(c.notePreview);
    if (!b) return;
    c.notice.sizes = c.notice.sizes.filter(function (n) {
      return n >= b.min && n <= b.max;
    });
    A.rangeNumbers(b).forEach(function (n) {
      c.noteChips.appendChild(noteChip(c, n));
    });
    c.notePreview.appendChild(notePreviewOf(c, b));
  };

  /**
   * Draws the text of the note in one language.
   *
   * @param {!Object} c The control.
   * @param {string} lang 'en' or 'ar'.
   * @return {!Element} The field.
   */
  function noteField(c, lang) {
    var ar = lang === 'ar';
    var text = c.notice.text;
    return A.field(
      ar ? 'Note in Arabic' : 'Note in English',
      h(
        'textarea',
        {
          class: 'textarea',
          rows: '2',
          name: c.o.names.note + (ar ? 'noticeAr' : 'noticeEn'),
          dir: ar ? 'rtl' : null,
          lang: ar ? 'ar' : null,
          placeholder: c.o.words.placeholder[lang],
          oninput: function (e) {
            text[lang] = e.target.value;
            // Only the English note is previewed.
            if (!ar) c.paint();
          }
        },
        text[lang] || ''
      )
    );
  }

  /**
   * Draws the box of the note: its help, its numbers, its text and its
   * preview.
   *
   * @param {!Object} c The control.
   * @return {!Element} The box.
   */
  A.rangeNoteBox = function (c) {
    var w = c.o.words;
    return h(
      'div',
      { class: 'subpanel' },
      h('h3', null, w.note),
      h(
        'p',
        { class: 'help' },
        w.noteHelp +
          ' Write {n} for the number they picked and {max} for the highest.'
      ),
      h('span', { class: 'label' }, w.noteFor),
      c.noteChips,
      h('div', { class: 'desc-pair' }, noteField(c, 'en'), noteField(c, 'ar')),
      c.notePreview
    );
  };
})(window.App);

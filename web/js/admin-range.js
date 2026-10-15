/**
 * A range of whole numbers that students choose from: the size of a team, or how many teammates
 * come with the leader of a booking. Both use this one control, so they look and check the same:
 * the lowest and the highest, the numbers students will see, the saved answers a new range leaves
 * outside, and a note shown to students who pick some of the numbers.
 */
(function (App) {
  'use strict';

  var ui = App.ui,
    h = ui.h,
    icon = ui.icon,
    A = App.admin;

  /**
   * range: { min, max, notice } of the form, changed in place; notice is { sizes, text: { en, ar } }.
   * o.floor and o.ceiling bound the range. o.counts is { number: saved answers with it }.
   * o.names: { min, max, outside, note } names of the inputs and the banner; note is a prefix for the note inputs.
   * o.words: { name, min, max, choose, unit, who, one, many, stay, fix, note, noteFor, noteHelp, placeholder: { en, ar } }.
   * Returns { node, problem() }: problem() is the reason the range cannot be saved, or ''.
   */
  A.sizeRange = function (range, o) {
    var w = o.words;
    var notice = (range.notice = range.notice || {
      sizes: [],
      text: { en: '', ar: '' }
    });
    notice.text = notice.text || { en: '', ar: '' };
    var bounds = function () {
      return { min: parseInt(range.min, 10), max: parseInt(range.max, 10) };
    };
    var valid = function (b) {
      return (
        b.min >= o.floor && b.max >= Math.max(b.min, 1) && b.max <= o.ceiling
      );
    };
    var rule =
      w.name +
      ' needs a minimum of at least ' +
      o.floor +
      ' and a maximum that is not lower' +
      (o.floor < 1 ? ' and at least 1' : '') +
      ', up to ' +
      o.ceiling +
      '.';
    var numbers = function (b) {
      var out = [];
      for (var n = b.min; n <= b.max; n++) out.push(n);
      return out;
    };

    var choices = h('div', { class: 'size-preview', 'aria-live': 'polite' });
    var paintChoices = function (b) {
      ui.clear(choices);
      if (!valid(b))
        return choices.appendChild(h('span', { class: 'muted-note' }, rule));
      choices.appendChild(h('span', { class: 'muted-note' }, w.choose + ': '));
      numbers(b).forEach(function (n) {
        choices.appendChild(h('span', { class: 'num-chip' }, String(n)));
      });
      if (w.unit)
        choices.appendChild(h('span', { class: 'muted-note' }, ' ' + w.unit));
    };

    // Answers saved earlier keep their number. The ones a new range leaves outside are counted here, before the save.
    var outside = h('div', {
      class: 'banner',
      role: 'alert',
      name: o.names.outside,
      hidden: true
    });
    var paintOutside = function (b) {
      var counts = o.counts || {};
      var n = !valid(b)
        ? 0
        : Object.keys(counts).reduce(function (sum, k) {
            return +k >= b.min && +k <= b.max ? sum : sum + counts[k];
          }, 0);
      outside.hidden = !n;
      outside.textContent = n
        ? A.plural(n, w.one + ' is', w.many + ' are') +
          ' outside ' +
          (b.min === b.max ? String(b.min) : b.min + ' to ' + b.max) +
          '. ' +
          (n === 1 ? 'It stays ' : 'They stay ') +
          w.stay +
          ' as ' +
          (n === 1 ? 'it is' : 'they are') +
          '. Widen the range, or ask ' +
          (n === 1 ? 'that team' : 'those teams') +
          ' ' +
          w.fix +
          '.'
        : '';
    };

    var noteChips = h('div', {
      class: 'toggle-chips',
      role: 'group',
      'aria-label': w.noteFor
    });
    var notePreview = h('div', {
      class: 'notice-preview',
      'aria-live': 'polite'
    });
    var paintNote = function (b) {
      ui.clear(noteChips);
      ui.clear(notePreview);
      if (!valid(b)) return;
      notice.sizes = notice.sizes.filter(function (n) {
        return n >= b.min && n <= b.max;
      });
      numbers(b).forEach(function (n) {
        var on = notice.sizes.indexOf(n) !== -1;
        noteChips.appendChild(
          h(
            'button',
            {
              type: 'button',
              class: 'toggle-chip',
              name: o.names.note + 'notice-size-' + n,
              'aria-pressed': on ? 'true' : 'false',
              onclick: function () {
                notice.sizes = on
                  ? notice.sizes.filter(function (x) {
                      return x !== n;
                    })
                  : notice.sizes.concat([n]).sort(function (a, c) {
                      return a - c;
                    });
                paint();
              }
            },
            String(n)
          )
        );
      });
      var sample = notice.sizes[0];
      var text = notice.sizes.length
        ? Rules.sizeNotice(notice, sample, b.max, 'en')
        : '';
      if (!notice.sizes.length)
        notePreview.appendChild(
          h(
            'span',
            { class: 'muted-note' },
            'Pick one or more numbers above to show the note.'
          )
        );
      else if (!text)
        notePreview.appendChild(
          h('span', { class: 'muted-note' }, 'Write the note below.')
        );
      else
        notePreview.appendChild(
          h(
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
              icon('info', 18),
              h('span', null, text)
            )
          )
        );
    };

    var paint = function () {
      var b = bounds();
      paintChoices(b);
      paintOutside(b);
      paintNote(b);
    };
    var limits = { min: String(o.floor), max: String(o.ceiling) };
    var node = h(
      'div',
      { class: 'size-range l-stack' },
      h(
        'div',
        { class: 'row' },
        A.field(
          w.min,
          A.number(
            range.min,
            function (v) {
              range.min = v;
              paint();
            },
            Object.assign({ name: o.names.min }, limits)
          )
        ),
        A.field(
          w.max,
          A.number(
            range.max,
            function (v) {
              range.max = v;
              paint();
            },
            Object.assign({ name: o.names.max }, limits)
          )
        )
      ),
      choices,
      outside,
      h(
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
        noteChips,
        h(
          'div',
          { class: 'desc-pair' },
          A.field(
            'Note in English',
            h(
              'textarea',
              {
                class: 'textarea',
                rows: '2',
                name: o.names.note + 'noticeEn',
                placeholder: w.placeholder.en,
                oninput: function (e) {
                  notice.text.en = e.target.value;
                  paint();
                }
              },
              notice.text.en || ''
            )
          ),
          A.field(
            'Note in Arabic',
            h(
              'textarea',
              {
                class: 'textarea',
                rows: '2',
                name: o.names.note + 'noticeAr',
                dir: 'rtl',
                lang: 'ar',
                placeholder: w.placeholder.ar,
                oninput: function (e) {
                  notice.text.ar = e.target.value;
                }
              },
              notice.text.ar || ''
            )
          )
        ),
        notePreview
      )
    );
    paint();

    return {
      node: node,
      problem: function () {
        if (!valid(bounds())) return rule;
        if (
          notice.sizes.length &&
          !(notice.text.en || '').trim() &&
          !(notice.text.ar || '').trim()
        )
          return (
            'Write the note for ' +
            w.name.toLowerCase() +
            ', or switch off its numbers.'
          );
        return '';
      }
    };
  };
})(window.App);

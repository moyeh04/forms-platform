/**
 * A team's own progress on the page of its registration: a line for each
 * milestone with its state and the note for the team. Read only. With an
 * ended key it is the only thing the page shows of the registration.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  /**
   * Draws the progress of a team.
   *
   * @param {?Array<!Object>} lines Each milestone: `label`, `state`, `note`.
   * @param {string=} note A line under the title.
   * @return {?Element} The block, or null when there is nothing to show.
   */
  P.progressBlock = function (lines, note) {
    if (!lines?.length) return null;
    return h(
      'section',
      { class: 'progress-mine', 'aria-labelledby': 'progress-mine-title' },
      h(
        'h3',
        { class: 'member-title', id: 'progress-mine-title' },
        t('progressTitle')
      ),
      note ? h('p', { class: 'step-help' }, note) : null,
      h(
        'ol',
        { class: 'progress-mine-list' },
        lines.map(function (m) {
          return h(
            'li',
            { dataset: { milestone: m.id } },
            h('span', { dir: 'auto' }, App.i18n.L(m.label)),
            h(
              'span',
              { class: 'pstate is-' + m.state },
              t('progressStates.' + m.state)
            ),
            m.note
              ? h('p', { class: 'progress-note', dir: 'auto' }, m.note)
              : null
          );
        })
      )
    );
  };

  /**
   * Reads the progress a key shows after it ended. Any failure shows
   * nothing, since the reason the key was refused is already shown.
   *
   * @param {string} key The key.
   * @return {!Promise<void>} Settles once `S.expiredProgress` is set.
   */
  P.loadExpiredProgress = async function (key) {
    var res;
    try {
      res = await App.api.call({
        action: 'progress.mine',
        slug: S.slug,
        key: key
      });
      S.expiredProgress = res.progress;
    } catch (_e) {
      S.expiredProgress = null;
    }
  };
})(window.App);

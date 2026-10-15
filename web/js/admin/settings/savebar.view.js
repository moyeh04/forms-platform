/**
 * The save bar of the settings page. It exists only while there is
 * something to save. Only what changed is sent, with the time of the copy
 * the page shows, so a save never undoes someone else's.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;
  var toast = App.ui.toast;

  var UNSAVED = 'You have changes that are not saved.';

  /**
   * Shows what the save bar says. The reason a save was refused stays
   * there until the next change.
   *
   * @param {!Element} note The note of the bar.
   * @param {string} text What it says.
   * @param {boolean=} refused True when a save was refused.
   */
  function say(note, text, refused) {
    note.textContent = text;
    note.classList.toggle('is-error', !!refused);
    note.setAttribute('role', refused ? 'alert' : 'status');
  }

  /**
   * Picks the parts of the patch that differ from the saved copy.
   *
   * @param {!Object} now The patch.
   * @param {!Object} was The saved copy.
   * @return {!Object} The changed parts.
   */
  function changed(now, was) {
    var patch = {};
    Object.keys(now).forEach(function (k) {
      if (JSON.stringify(now[k]) !== JSON.stringify(was[k])) {
        patch[k] = now[k];
      }
    });
    return patch;
  }

  /**
   * Saves the settings, or shows what stops the save in its panel. The
   * page is drawn again from the server once saved; a new link name opens
   * the new address.
   *
   * @param {!Object} s The settings page: `f`, `slug`, `saved` and
   *     `show(tab)`.
   * @param {!Element} note The note of the bar.
   * @return {!Promise} Settles when it is saved or refused.
   */
  async function save(s, note) {
    var stop = A.settingsProblem(s);
    if (stop) {
      s.show(stop.panel.tab);
      stop.panel.setOpen(true);
      say(note, stop.text, true);
      return;
    }
    var patch = changed(A.settingsPatch(s), JSON.parse(s.saved));
    var out;
    try {
      out = await A.call('admin.forms.update', {
        id: s.f.id,
        base: s.f.updatedAt,
        patch: patch
      });
    } catch (e) {
      say(note, A.message(e), true);
      return;
    }
    A.unsaved = false;
    toast('Settings saved', 'ok');
    if (out.form.slug !== s.slug) {
      window.location.hash =
        '#/f/' + encodeURIComponent(out.form.slug) + '/settings';
    } else {
      A.render();
    }
  }

  /**
   * Draws the save bar.
   *
   * @param {!Object} s The settings page. `saved` is set here: the patch as
   *     the page opened.
   * @return {{node: !Element, refresh: function(?Event=)}} The bar, and
   *     what runs after each change: the folded lines are drawn again and
   *     the bar shows while the patch differs from the saved copy.
   */
  A.saveBar = function (s) {
    var note = h('span', { class: 'savebar-note', role: 'status' }, UNSAVED);
    var saveBtn = h(
      'button',
      { type: 'button', class: 'btn btn-primary', name: 'save' },
      'Save settings'
    );
    saveBtn.addEventListener('click', function () {
      A.busy(saveBtn, function () {
        return save(s, note);
      });
    });
    s.saved = JSON.stringify(A.settingsPatch(s));
    var bar = h(
      'div',
      { class: 'savebar', hidden: true },
      note,
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet',
          name: 'discard',
          onclick: function () {
            A.unsaved = false;
            A.render();
          }
        },
        'Discard'
      ),
      saveBtn
    );

    /**
     * Takes in a change of the page.
     *
     * @param {?Event=} e The event; one inside the bar keeps its note.
     */
    function refresh(e) {
      if (!(e && bar.contains(e.target))) say(note, UNSAVED);
      s.sections.forEach(function (n) {
        n.paintSummary();
      });
      A.unsaved = JSON.stringify(A.settingsPatch(s)) !== s.saved;
      bar.hidden = !A.unsaved;
    }

    return { node: bar, refresh: refresh };
  };
})(window.App);

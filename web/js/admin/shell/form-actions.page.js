/**
 * What is done to a whole form from its card or its header: delete it, or
 * copy it for a new term.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;
  var toast = App.ui.toast;

  /**
   * Deletes a form after one confirmation. Its sheet goes to the Drive
   * trash.
   *
   * @param {!Object} f The form.
   * @param {function()=} after Called once it is deleted; the page is drawn
   *     again when absent.
   * @return {!Promise<boolean>} True when it was deleted.
   */
  A.deleteForm = async function (f, after) {
    var ok = await App.ui.confirm({
      title: 'Delete "' + f.title + '"?',
      body:
        'Its link stops working right away and it leaves the dashboard and' +
        ' every instructor link. Its Google Sheet, with all registrations,' +
        ' moves to your Drive trash, where you can restore it for 30 days.',
      confirmText: 'Delete form',
      cancelText: 'Keep it',
      danger: true
    });
    if (!ok) return false;
    var r;
    try {
      r = await A.call('admin.forms.delete', { id: f.id, confirm: f.slug });
    } catch (e) {
      A.fail(e);
      return false;
    }
    toast(
      r.sheetTrashed
        ? 'Form deleted. Its sheet is in the Drive trash.'
        : 'Form deleted.',
      'ok'
    );
    if (after) after();
    else A.render();
    return true;
  };

  /**
   * Asks for the title and the term of a copy of a form, then makes it.
   * The copy keeps every setting, starts as a draft, and gets its own
   * empty Google Sheet.
   *
   * @param {!Object} f The form.
   */
  A.duplicateForm = function (f) {
    var title = f.title;
    var metadata = FormMetadata.read(f);
    var body = h(
      'div',
      null,
      h(
        'p',
        { class: 'help' },
        'The copy keeps every setting, starts as a draft, and gets its own' +
          ' empty Google Sheet.'
      ),
      A.field(
        'Title',
        A.text(title, function (v) {
          title = v;
        })
      ),
      A.metadataEditor(f.type, metadata, function (v) {
        Object.assign(metadata, v);
      })
    );

    /** Makes the copy and opens its setup. */
    async function copy() {
      var res = await A.call(
        'admin.forms.duplicate',
        Object.assign({ id: f.id, title: title }, metadata)
      );
      toast('Copy created as a draft', 'ok');
      window.location.hash =
        '#/f/' + encodeURIComponent(res.form.slug) + '/settings';
    }

    A.modal('Duplicate "' + f.title + '"', body, [
      { text: 'Cancel', kind: 'quiet' },
      { text: 'Make a copy', kind: 'primary', onclick: copy }
    ]);
  };
})(window.App);

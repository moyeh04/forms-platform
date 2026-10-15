/** Turning text into link names and into safe HTML. */

var Text = (function () {
  /**
   * Turns a title into a link name: lower-case letters and digits joined by
   * single hyphens.
   *
   * @param {*} s The title.
   * @return {string} The link name, or `form` when nothing of it is left.
   */
  function slugify(s) {
    var out = String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return out || 'form';
  }

  /**
   * Escapes text for HTML, inside an element or a quoted attribute.
   *
   * @param {*} s The text.
   * @return {string} The text with `&`, `<`, `>` and `"` escaped.
   */
  function esc_(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { slugify, esc: esc_ };
})();

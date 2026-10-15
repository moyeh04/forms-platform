/**
 * The end of Download all: a button to save each zip part, the items that
 * were not downloaded, and the Drive folder the zips stay in.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;

  /** A whole, for the share of a part already saved. */
  var PERCENT = 100;

  /**
   * Draws the button that saves a zip part, with how far it is.
   *
   * @param {!Object} d The download: form.
   * @param {string} job The download job.
   * @param {!Array<!Object>} parts Every part.
   * @param {number} i Which part, from 0.
   * @return {!Element} The button.
   */
  function saveButton(d, job, parts, i) {
    var part = parts[i];
    var label =
      (parts.length > 1
        ? 'Save part ' + (i + 1) + ' of ' + parts.length
        : 'Save the zip') +
      ' (' +
      R.sizeText(part.size) +
      ')';
    var btn = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        name: 'save-part-' + i,
        onclick: function () {
          A.busy(btn, async function () {
            await R.savePart(d.form, job, part, function (got, all) {
              btn.lastChild.textContent =
                'Saving ' +
                Math.round((got / Math.max(all, 1)) * PERCENT) +
                '%';
            });
            btn.lastChild.textContent = label.replace(/^Save/, 'Saved');
            ui.toast(part.name + ' saved', 'ok');
          });
        }
      },
      ui.icon('download', A.ICON_SIZE.LINE),
      label
    );
    return btn;
  }

  /**
   * Draws an item that was not downloaded, with its reason and its link.
   *
   * @param {!Object} f The item.
   * @return {!Element} The line.
   */
  function missedItem(f) {
    // "Projects/03 - Library/Diagrams/erd.png" names the file inside the
    // team's folder.
    var inner = f.path.split('/').slice(2).join('/');
    return h(
      'li',
      null,
      h('strong', null, 'Team ' + f.number),
      ' · ',
      f.title || '',
      inner ? ' · ' + inner : '',
      ': ',
      h('span', { class: 'muted-note' }, f.reason),
      f.url
        ? [
            ' ',
            h('a', { href: f.url, target: '_blank', rel: 'noopener' }, 'Open')
          ]
        : null
    );
  }

  /**
   * Draws the items that were not downloaded.
   *
   * @param {!Array<!Object>} failed The items.
   * @return {!Element} The list with its heading.
   */
  function missedList(failed) {
    return h(
      'div',
      { class: 'download-missed' },
      h(
        'h3',
        null,
        A.plural(failed.length, 'item was', 'items were') + ' not downloaded'
      ),
      h(
        'p',
        { class: 'help' },
        'They are also listed in Teams.xlsx, on the sheet "Not downloaded",' +
          ' each with its Drive link.'
      ),
      h('ul', { class: 'plain-list' }, failed.map(missedItem))
    );
  }

  /**
   * Draws the end of the download.
   *
   * @param {!Object} d The download: form and body.
   * @param {!Object} out The start, the finish and the parts.
   */
  R.downloadFinished = function (d, out) {
    var fin = out.fin;
    var body = d.body;
    ui.clear(body);
    body.appendChild(
      h(
        'p',
        null,
        h('strong', null, A.plural(fin.files, 'file', 'files') + ' packed'),
        fin.parts > 1
          ? ' in ' +
              fin.parts +
              ' zip parts. Save every part into the same folder and unzip' +
              ' them there: Teams.xlsx in part 1 links to the files in all' +
              ' of them.'
          : '.'
      )
    );
    body.appendChild(
      h(
        'div',
        { class: 'download-parts' },
        out.parts.map(function (_part, i) {
          return saveButton(d, out.start.job, out.parts, i);
        })
      )
    );
    if (fin.failed.length) body.appendChild(missedList(fin.failed));
    body.appendChild(
      h(
        'p',
        { class: 'help' },
        'The zips also stay in your Google Drive, in Forms Platform / Exports' +
          ' / Downloads, until the next download of this form. ',
        h(
          'a',
          { href: out.start.folderUrl, target: '_blank', rel: 'noopener' },
          'Open the folder'
        )
      )
    );
  };
})(window.App);

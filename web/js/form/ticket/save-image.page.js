/**
 * Saves the ticket as an image, with the torn edges the page shows. The
 * drawing library is fetched the first time a student asks.
 */
(function (App) {
  'use strict';

  var T = App.ticket;

  /** The library that draws a part of the page onto a canvas. */
  var HTML2CANVAS_URL =
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/' +
    'html2canvas.min.js';

  /** The image has this many pixels for each pixel of the page. */
  var IMAGE_SCALE = 2;

  /** The zigzag of the torn edges, in page pixels. */
  var TEAR = { TOOTH_PX: 18, DEPTH_PX: 9 };

  /**
   * Loads a script into the page.
   *
   * @param {string} src Its address.
   * @return {!Promise} Settles when it has loaded or failed.
   */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /**
   * Cuts the zigzag of the ticket's top and bottom edges out of a saved
   * image, as the page shows them.
   *
   * @param {!HTMLCanvasElement} canvas The image.
   * @param {number} scale Its pixels for each pixel of the page.
   */
  function tearEdges(canvas, scale) {
    var g = canvas.getContext('2d');
    var w = canvas.width;
    var tooth = TEAR.TOOTH_PX * scale;
    var deep = TEAR.DEPTH_PX * scale;
    // html2canvas leaves its own scale and page offset on the context; the
    // cut is in canvas pixels.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    for (let x = 0; x < w; x += tooth) {
      g.moveTo(x, 0);
      g.lineTo(x + tooth / 2, deep);
      g.lineTo(x + tooth, 0);
      g.moveTo(x, canvas.height);
      g.lineTo(x + tooth / 2, canvas.height - deep);
      g.lineTo(x + tooth, canvas.height);
    }
    g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  /**
   * Makes the browser download an image.
   *
   * @param {!HTMLCanvasElement} canvas The image.
   * @param {string} name The file name, without its extension.
   */
  function download(canvas, name) {
    var a = document.createElement('a');
    a.download = name + '.png';
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Saves a part of the page as an image.
   *
   * @param {!Element} node The part, the ticket.
   * @param {string=} name The file name; "registration" when absent.
   * @return {!Promise} Settles when the image is saved or fails.
   */
  async function saveImage(node, name) {
    if (!window.html2canvas) await loadScript(HTML2CANVAS_URL);
    var cs = getComputedStyle(document.body);
    var canvas = await window.html2canvas(node, {
      backgroundColor: cs.backgroundColor,
      scale: IMAGE_SCALE,
      useCORS: true,
      onclone: still
    });
    tearEdges(canvas, IMAGE_SCALE);
    download(canvas, name || 'registration');
  }

  /**
   * Stops the motion in the copy of the page the image is drawn from, so
   * its hands and slice are drawn where they stop.
   *
   * @param {!Document} doc The copy.
   */
  function still(doc) {
    doc.documentElement.classList.add('still');
  }

  T.saveImage = saveImage;
})(window.App);

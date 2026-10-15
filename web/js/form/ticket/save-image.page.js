/** Saving the ticket as an image. */
(function (App) {
  'use strict';

  var T = App.ticket;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /** Cuts the zigzag of the ticket's top and bottom edges out of a saved image, as the page shows them. */
  function tearEdges(canvas, scale) {
    var g = canvas.getContext('2d'),
      w = canvas.width,
      tooth = 18 * scale,
      deep = 9 * scale;
    // html2canvas leaves its own scale and page offset on the context; the cut is in canvas pixels.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    for (var x = 0; x < w; x += tooth) {
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

  async function saveImage(node, name) {
    if (!window.html2canvas)
      await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      );
    var cs = getComputedStyle(document.body);
    var canvas = await window.html2canvas(node, {
      backgroundColor: cs.backgroundColor,
      scale: 2,
      useCORS: true,
      // The copy is drawn at once, so its hands and slice are drawn where they stop.
      onclone: function (doc) {
        doc.documentElement.classList.add('still');
      }
    });
    tearEdges(canvas, 2);
    var a = document.createElement('a');
    a.download = (name || 'registration') + '.png';
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  T.saveImage = saveImage;
})(window.App);

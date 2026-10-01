/**
 * Opens one of the real HTML pages in jsdom and wires its fetch() straight
 * to the in-memory Apps Script world, so browser code and backend code are
 * tested together exactly as a student would use them.
 */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..', '..');

function scriptsOf(html) {
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
}

async function openPage(file, world, { query = '', hash = '', lang } = {}) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const dom = new JSDOM(html, {
    url: `http://localhost/${file}${query}${hash}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.__FORM_NO_AUTOSTART__ = true;
  window.__PAGE_NO_AUTOSTART__ = true;
  window.scrollTo = () => {};
  window.Element.prototype.scrollIntoView = () => {};
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  window.fetch = async (url, opts) => ({ json: async () => world.api(JSON.parse(opts.body)) });
  window.print = () => { window.__printed = true; };
  if (lang) window.localStorage.setItem('fp_lang', lang);

  for (const src of scriptsOf(html)) {
    window.eval(fs.readFileSync(path.join(root, src), 'utf8'));
  }
  window.APP_CONFIG.API_URL = 'http://api.test/exec';
  return dom;
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function settle(n = 6) { for (let i = 0; i < n; i++) await tick(0); }

function helpers(window) {
  const doc = window.document;
  const $ = (s, el = doc) => el.querySelector(s);
  const $$ = (s, el = doc) => [...el.querySelectorAll(s)];
  const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true }));
  return {
    $, $$, fire,
    type(sel, value) {
      const el = typeof sel === 'string' ? $(sel) : sel;
      if (!el) throw new Error('No element for ' + sel);
      el.value = value;
      fire(el, 'input');
      fire(el, 'change');
      fire(el, 'blur');
      return el;
    },
    pick(path, value) {
      const radio = $(`input[type=radio][name="${path}"][value="${value}"]`);
      if (radio) { radio.checked = true; fire(radio, 'change'); return radio; }
      const sel = $(`select[name="${path}"]`);
      if (!sel) throw new Error('No choice field ' + path);
      sel.value = value;
      fire(sel, 'change');
      return sel;
    },
    click(el) {
      if (typeof el === 'string') el = $(el);
      if (!el) throw new Error('Nothing to click');
      el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    },
    clickText(text, scope = doc) {
      const el = $$('button, a', scope).find((b) => b.textContent.trim().includes(text));
      if (!el) throw new Error('No button with text: ' + text + ' | have: ' + $$('button', scope).map((b) => b.textContent.trim()).join(' / '));
      el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    },
    submitForm() {
      const f = $('form');
      f.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    },
    text: () => doc.body.textContent.replace(/\s+/g, ' ').trim()
  };
}

module.exports = { openPage, helpers, settle, tick };

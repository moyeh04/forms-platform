/**
 * In-memory Apps Script world for tests.
 *
 * Loads the real bundled backend into a vm context next to fake versions of
 * SpreadsheetApp, DriveApp, LockService, CacheService, PropertiesService,
 * MailApp, Utilities and friends, so the whole platform can be exercised
 * (create form, submit, edit with key, book slots, print views) without Google.
 */
const vm = require('node:vm');
const crypto = require('node:crypto');
const { bundleSource } = require('../../scripts/bundle-backend.js');

/* ── Spreadsheet ─────────────────────────────────────────────── */

class MockRange {
  constructor(sheet, r, c, nr, nc) {
    this.sheet = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc;
    this.proxy = new Proxy(this, {
      get: (t, p) => (p in t ? (typeof t[p] === 'function' ? t[p].bind(t) : t[p]) : (...a) => t.proxy)
    });
  }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(this.sheet.get(this.r + i, this.c + j));
      out.push(row);
    }
    return out;
  }
  getDisplayValues() { return this.getValues(); }
  getValue() { return this.getValues()[0][0]; }
  setValues(vals) {
    for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals[i].length; j++) this.sheet.set(this.r + i, this.c + j, vals[i][j]);
    return this.proxy;
  }
  setValue(v) {
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.set(this.r + i, this.c + j, v);
    return this.proxy;
  }
  setFormula(f) { return this.setValue(f); }
  clear() { return this.clearContent(); }
  clearContent() {
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.cells.delete(`${this.r + i},${this.c + j}`);
    return this.proxy;
  }
  getRow() { return this.r; }
  getColumn() { return this.c; }
  getNumRows() { return this.nr; }
  getNumColumns() { return this.nc; }
  getSheet() { return this.sheet.proxy; }
}

class MockSheet {
  constructor(ss, name, id) {
    this.ss = ss; this.name = name; this.id = id; this.cells = new Map(); this.hidden = false;
    this.proxy = new Proxy(this, {
      get: (t, p) => (p in t ? (typeof t[p] === 'function' ? t[p].bind(t) : t[p]) : (...a) => t.proxy)
    });
  }
  get(r, c) { const v = this.cells.get(`${r},${c}`); return v === undefined ? '' : v; }
  set(r, c, v) { if (v === '' || v === null || v === undefined) this.cells.delete(`${r},${c}`); else this.cells.set(`${r},${c}`, v); }
  getName() { return this.name; }
  setName(n) { this.name = n; return this.proxy; }
  getSheetId() { return this.id; }
  getParent() { return this.ss.proxy; }
  getLastRow() { let m = 0; for (const k of this.cells.keys()) m = Math.max(m, +k.split(',')[0]); return m; }
  getLastColumn() { let m = 0; for (const k of this.cells.keys()) m = Math.max(m, +k.split(',')[1]); return m; }
  getMaxRows() { return Math.max(1000, this.getLastRow()); }
  getMaxColumns() { return Math.max(26, this.getLastColumn()); }
  getRange(r, c, nr, nc) { return new MockRange(this, r, c, nr || 1, nc || 1).proxy; }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  appendRow(arr) { const r = this.getLastRow() + 1; arr.forEach((v, j) => this.set(r, j + 1, v)); return this.proxy; }
  deleteRow(n) {
    const next = new Map();
    for (const [k, v] of this.cells) {
      const [r, c] = k.split(',').map(Number);
      if (r === n) continue;
      next.set(`${r > n ? r - 1 : r},${c}`, v);
    }
    this.cells = next;
    return this.proxy;
  }
  clear() { this.cells.clear(); return this.proxy; }
  clearContents() { this.cells.clear(); return this.proxy; }
  hideSheet() { this.hidden = true; return this.proxy; }
  rows() { const out = []; for (let r = 1; r <= this.getLastRow(); r++) out.push(this.getRange(r, 1, 1, this.getLastColumn()).getValues()[0]); return out; }
}

class MockSpreadsheet {
  constructor(world, id, name) {
    this.world = world; this.id = id; this.name = name; this.sheets = []; this.nextSheetId = 1;
    this.proxy = new Proxy(this, { get: (t, p) => (p in t ? (typeof t[p] === 'function' ? t[p].bind(t) : t[p]) : (...a) => t.proxy) });
    this.insertSheet('Sheet1');
  }
  getId() { return this.id; }
  getName() { return this.name; }
  getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}/edit`; }
  getSheets() { return this.sheets.map((s) => s.proxy); }
  getSheetByName(n) { const s = this.sheets.find((x) => x.name === n); return s ? s.proxy : null; }
  insertSheet(name) {
    if (this.sheets.some((s) => s.name === name)) throw new Error(`A sheet with the name "${name}" already exists.`);
    const s = new MockSheet(this, name, this.nextSheetId++);
    this.sheets.push(s);
    return s.proxy;
  }
  deleteSheet(sheet) { this.sheets = this.sheets.filter((s) => s.proxy !== sheet && s !== sheet); return this.proxy; }
  rename(n) { this.name = n; }
}

/* ── World ───────────────────────────────────────────────────── */

function createWorld(options = {}) {
  const world = {
    nowMs: options.now || Date.parse('2027-09-01T10:00:00Z'),
    spreadsheets: new Map(),
    props: new Map(),
    cache: new Map(),
    mail: [],
    triggers: [],
    drive: { access: new Map(), missing: new Set(), folders: new Map(), files: new Map() },
    logs: []
  };
  const uid = () => crypto.randomBytes(16).toString('hex');

  const createSs = (name) => { const ss = new MockSpreadsheet(world, uid(), name); world.spreadsheets.set(ss.id, ss); world.drive.files.set(ss.id, { name, isSheet: true }); return ss; };
  world.registry = createSs('Forms Registry');

  const fileObj = (id) => ({
    getId: () => id,
    getName: () => (world.drive.files.get(id) || {}).name || id,
    getUrl: () => `https://drive.google.com/file/d/${id}/view`,
    getSharingAccess: () => world.drive.access.get(id) || 'ANYONE_WITH_LINK',
    moveTo: () => fileObj(id),
    getBlob: () => ({ getName: () => id })
  });
  const folderObj = (id) => ({
    getId: () => id,
    getName: () => world.drive.folders.get(id).name,
    getSharingAccess: () => world.drive.access.get(id) || 'ANYONE_WITH_LINK',
    createFolder: (name) => { const nid = uid(); world.drive.folders.set(nid, { name }); return folderObj(nid); },
    getFoldersByName: (name) => {
      const hits = [...world.drive.folders].filter(([, f]) => f.name === name).map(([id]) => folderObj(id));
      let i = 0; return { hasNext: () => i < hits.length, next: () => hits[i++] };
    },
    createFile: (blobOrName) => { const nid = uid(); world.drive.files.set(nid, { name: (blobOrName && blobOrName.name) || String(blobOrName) }); return fileObj(nid); }
  });

  const sandbox = {
    console, Logger: { log: (m) => world.logs.push(String(m)) },
    SpreadsheetApp: {
      getActive: () => world.registry.proxy,
      getActiveSpreadsheet: () => world.registry.proxy,
      openById: (id) => { const s = world.spreadsheets.get(id); if (!s) throw new Error('No spreadsheet ' + id); return s.proxy; },
      create: (name) => createSs(name).proxy,
      BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM', SOLID_THICK: 'SOLID_THICK' },
      getUi: () => { throw new Error('UI not available in tests'); }
    },
    DriveApp: {
      getRootFolder: () => folderObj('root'),
      createFolder: (name) => { const id = uid(); world.drive.folders.set(id, { name }); return folderObj(id); },
      getFoldersByName: (name) => folderObj('root').getFoldersByName(name),
      getFolderById: (id) => {
        if (world.drive.missing.has(id)) throw new Error('No item with the given ID could be found');
        if (!world.drive.folders.has(id)) world.drive.folders.set(id, { name: id });
        return folderObj(id);
      },
      getFileById: (id) => {
        if (world.drive.missing.has(id)) throw new Error('No item with the given ID could be found');
        if (!world.drive.files.has(id)) world.drive.files.set(id, { name: id });
        return fileObj(id);
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (world.props.has(k) ? world.props.get(k) : null),
        setProperty(k, v) { world.props.set(k, String(v)); return this; },
        setProperties(o) { Object.keys(o).forEach((k) => world.props.set(k, String(o[k]))); return this; },
        deleteProperty(k) { world.props.delete(k); return this; },
        getProperties: () => Object.fromEntries(world.props)
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => { const e = world.cache.get(k); return e && e.until > world.nowMs ? e.v : null; },
        put: (k, v, ttl) => world.cache.set(k, { v: String(v), until: world.nowMs + (ttl || 600) * 1000 }),
        remove: (k) => world.cache.delete(k)
      })
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, tryLock: () => true, releaseLock: () => {}, hasLock: () => true }) },
    MailApp: { sendEmail: (a, b, c) => world.mail.push(typeof a === 'object' ? a : { to: a, subject: b, body: c }) },
    Session: {
      getScriptTimeZone: () => 'Africa/Cairo',
      getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }),
      getActiveUser: () => ({ getEmail: () => 'owner@example.com' })
    },
    ScriptApp: {
      getProjectTriggers: () => world.triggers.map((t) => ({ getHandlerFunction: () => t, getUniqueId: () => t })),
      deleteTrigger: () => {},
      getOAuthToken: () => 'test-token',
      newTrigger: (fn) => {
        const chain = new Proxy({}, { get: (t, p) => (p === 'create' ? () => world.triggers.push(fn) : () => chain) });
        return chain;
      }
    },
    UrlFetchApp: {
      fetch: (...a) => {
        if (!world.fetch) throw new Error('Network is not available in tests');
        return world.fetch(...a);
      }
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (text) => ({ getContent: () => text, setMimeType() { return this; } })
    },
    HtmlService: { createHtmlOutput: (h) => ({ html: h, setWidth() { return this; }, setHeight() { return this; } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5' },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (algo, value) => Array.from(crypto.createHash(algo).update(String(value), 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      base64Encode: (v) => Buffer.from(typeof v === 'string' ? v : v.map((b) => (b + 256) % 256)).toString('base64'),
      newBlob: (data, type, name) => ({ data, type, name }),
      sleep: () => {}
    }
  };

  // A controllable clock for everything inside the backend.
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(world.nowMs); }
    static now() { return world.nowMs; }
  }
  sandbox.Date = FakeDate;
  sandbox.Math = Object.create(Math);
  sandbox.Math.random = () => (world.random ? world.random() : Math.random());

  const ctx = vm.createContext(sandbox);
  const { code } = bundleSource();
  vm.runInContext(code, ctx, { filename: 'Code.gs' });

  world.ctx = ctx;
  world.setNow = (ms) => { world.nowMs = typeof ms === 'string' ? Date.parse(ms) : ms; };
  world.advanceDays = (d) => { world.nowMs += d * 86400000; };

  /** Calls the web app entry point exactly like the browser does. */
  world.api = (body) => {
    const out = vm.runInContext('doPost', ctx)({ postData: { contents: JSON.stringify(body), type: 'text/plain' } });
    return JSON.parse(out.getContent());
  };
  world.call = (name, ...args) => vm.runInContext(name, ctx)(...args);
  world.sheet = (ssId, name) => { const s = world.spreadsheets.get(ssId).getSheetByName(name); return s; };
  world.drive.setAccess = (id, a) => world.drive.access.set(id, a);
  return world;
}

module.exports = { createWorld };

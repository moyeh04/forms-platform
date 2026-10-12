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
const zlib = require('node:zlib');
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
    drive: { access: new Map(), missing: new Set(), folders: new Map(), files: new Map(), trashed: new Set() },
    logs: []
  };
  const uid = () => crypto.randomBytes(16).toString('hex');

  const createSs = (name) => { const ss = new MockSpreadsheet(world, uid(), name); world.spreadsheets.set(ss.id, ss); world.drive.files.set(ss.id, { name, isSheet: true }); return ss; };
  world.registry = createSs('Forms Registry');

  // Blobs hold real bytes, so a zip or a workbook the backend builds can be opened in a test.
  class MockBlob {
    constructor(bytes, type, name) { this.buf = Buffer.from(bytes == null ? '' : bytes); this.type = type || ''; this.name = name || ''; this.data = bytes; }
    getBytes() { return Array.from(this.buf, (b) => (b > 127 ? b - 256 : b)); }
    getName() { return this.name; }
    setName(n) { this.name = n; return this; }
    getContentType() { return this.type; }
    setContentType(t) { this.type = t; return this; }
    getDataAsString() { return this.buf.toString('utf8'); }
    copyBlob() { return new MockBlob(this.buf, this.type, this.name); }
  }
  const toBuf = (v) => (Buffer.isBuffer(v) ? v : Array.isArray(v) ? Buffer.from(v.map((b) => (b + 256) % 256)) : Buffer.from(String(v == null ? '' : v), 'utf8'));
  /** A plain zip (stored, not compressed) with UTF-8 names. */
  function zipOf(blobs, name) {
    const parts = [], central = [];
    let offset = 0;
    blobs.forEach((b) => {
      const data = b.buf, fname = Buffer.from(b.name, 'utf8'), crc = zlib.crc32(data);
      const head = Buffer.alloc(30);
      head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(0, 8);
      head.writeUInt32LE(crc >>> 0, 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(fname.length, 26);
      const dir = Buffer.alloc(46);
      dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x0800, 8);
      dir.writeUInt32LE(crc >>> 0, 16); dir.writeUInt32LE(data.length, 20); dir.writeUInt32LE(data.length, 24); dir.writeUInt16LE(fname.length, 28); dir.writeUInt32LE(offset, 42);
      parts.push(head, fname, data); central.push(dir, fname);
      offset += 30 + fname.length + data.length;
    });
    const cd = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(blobs.length, 8); end.writeUInt16LE(blobs.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return new MockBlob(Buffer.concat(parts.concat([cd, end])), 'application/zip', name || 'archive.zip');
  }
  world.MockBlob = MockBlob;
  /** Puts a file in pretend Drive: { name, mime, bytes, parent }. Returns its id. */
  world.drive.addFile = (o) => { const id = o.id || uid(); world.drive.files.set(id, { name: o.name, mime: o.mime || 'application/octet-stream', buf: toBuf(o.bytes || ''), parent: o.parent }); return id; };
  world.drive.addFolder = (o) => { const id = o.id || uid(); world.drive.folders.set(id, { name: o.name, parent: o.parent }); return id; };
  const iter = (list) => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; };

  const fileObj = (id) => ({
    getId: () => id,
    getName: () => (world.drive.files.get(id) || {}).name || id,
    getMimeType: () => (world.drive.files.get(id) || {}).mime || 'application/octet-stream',
    getSize: () => ((world.drive.files.get(id) || {}).buf || Buffer.alloc(0)).length,
    getUrl: () => `https://drive.google.com/file/d/${id}/view`,
    getSharingAccess: () => world.drive.access.get(id) || 'ANYONE_WITH_LINK',
    moveTo: () => fileObj(id),
    setTrashed: (v) => { if (v) world.drive.trashed.add(id); else world.drive.trashed.delete(id); return fileObj(id); },
    isTrashed: () => world.drive.trashed.has(id),
    getBlob: () => { const f = world.drive.files.get(id) || {}; return new MockBlob(f.buf || Buffer.alloc(0), f.mime, f.name || id); }
  });
  const folderObj = (id) => ({
    getId: () => id,
    getName: () => world.drive.folders.get(id).name,
    getSharingAccess: () => world.drive.access.get(id) || 'ANYONE_WITH_LINK',
    getUrl: () => `https://drive.google.com/drive/folders/${id}`,
    setTrashed: (v) => { if (v) world.drive.trashed.add(id); else world.drive.trashed.delete(id); return folderObj(id); },
    createFolder: (name) => { const nid = uid(); world.drive.folders.set(nid, { name, parent: id }); return folderObj(nid); },
    getFoldersByName: (name) => iter([...world.drive.folders].filter(([fid, f]) => f.name === name && (f.parent === undefined || f.parent === id) && !world.drive.trashed.has(fid)).map(([fid]) => folderObj(fid))),
    getFolders: () => iter([...world.drive.folders].filter(([fid, f]) => f.parent === id && !world.drive.trashed.has(fid)).map(([fid]) => folderObj(fid))),
    getFiles: () => iter([...world.drive.files].filter(([fid, f]) => f.parent === id && !world.drive.trashed.has(fid)).map(([fid]) => fileObj(fid))),
    createFile: (blobOrName) => {
      const nid = uid();
      const blob = blobOrName instanceof MockBlob ? blobOrName : null;
      world.drive.files.set(nid, { name: (blobOrName && blobOrName.name) || String(blobOrName), mime: blob ? blob.type : '', buf: blob ? blob.buf : Buffer.alloc(0), parent: id });
      return fileObj(nid);
    }
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
      base64Encode: (v) => toBuf(v).toString('base64'),
      formatDate: (date, tz, pattern) => {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map((x) => [x.type, x.value]));
        return pattern.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day);
      },
      newBlob: (data, type, name) => new MockBlob(toBuf(data), type, name),
      zip: (blobs, name) => zipOf(blobs, name),
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
  world.drive.setFolderName = (id, name) => world.drive.folders.set(id, { name });
  return world;
}

module.exports = { createWorld };

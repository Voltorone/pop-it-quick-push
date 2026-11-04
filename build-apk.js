const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

/**
 * Pure Node.js Android APK Builder & Signer (APK Signature Scheme v1 + v2)
 * Bundles mobile-preview.html into a standalone fullscreen Android WebView APK:
 *   c:\Users\Silvia Gabriel\Desktop\project 3\ALE-POP-QuickPush.apk
 */

// ---------------------------------------------------------------------------
// 1. DALVIK BYTECODE (classes.dex) GENERATOR
// ---------------------------------------------------------------------------
function buildClassesDex() {
  // All strings required by MainActivity
  const rawStrings = [
    '<init>',
    'L',
    'Landroid/app/Activity;',
    'Landroid/content/Context;',
    'Landroid/os/Bundle;',
    'Landroid/view/View;',
    'Landroid/webkit/WebSettings;',
    'Landroid/webkit/WebView;',
    'Lcom/alehop/popitquickpush/MainActivity;',
    'Ljava/lang/String;',
    'V',
    'VL',
    'VZ',
    'Z',
    'file:///android_asset/index.html',
    'getSettings',
    'loadUrl',
    'onCreate',
    'setContentView',
    'setDomStorageEnabled',
    'setJavaScriptEnabled',
    'setMediaPlaybackRequiresUserGesture',
  ].sort(); // Lexicographical sort (ASCII == UTF-16 code unit order)

  const strIdx = (s) => {
    const i = rawStrings.indexOf(s);
    if (i < 0) throw new Error(`Missing string in DEX pool: ${s}`);
    return i;
  };

  // Types sorted by descriptor string index
  const typeDescriptors = [
    'Landroid/app/Activity;',
    'Landroid/content/Context;',
    'Landroid/os/Bundle;',
    'Landroid/view/View;',
    'Landroid/webkit/WebSettings;',
    'Landroid/webkit/WebView;',
    'Lcom/alehop/popitquickpush/MainActivity;',
    'Ljava/lang/String;',
    'V',
    'Z',
  ].sort((a, b) => strIdx(a) - strIdx(b));

  const typeIdx = (t) => {
    const i = typeDescriptors.indexOf(t);
    if (i < 0) throw new Error(`Missing type in DEX pool: ${t}`);
    return i;
  };

  // Prototypes sorted by return_type_idx, then parameter type_idx list
  const protos = [
    { shorty: 'L', ret: 'Landroid/webkit/WebSettings;', params: [] },
    { shorty: 'V', ret: 'V', params: [] },
    { shorty: 'VL', ret: 'V', params: ['Landroid/content/Context;'] },
    { shorty: 'VL', ret: 'V', params: ['Landroid/os/Bundle;'] },
    { shorty: 'VL', ret: 'V', params: ['Landroid/view/View;'] },
    { shorty: 'VL', ret: 'V', params: ['Ljava/lang/String;'] },
    { shorty: 'VZ', ret: 'V', params: ['Z'] },
  ].sort((a, b) => {
    const rDiff = typeIdx(a.ret) - typeIdx(b.ret);
    if (rDiff !== 0) return rDiff;
    const len = Math.min(a.params.length, b.params.length);
    for (let i = 0; i < len; i++) {
      const pDiff = typeIdx(a.params[i]) - typeIdx(b.params[i]);
      if (pDiff !== 0) return pDiff;
    }
    return a.params.length - b.params.length;
  });

  const protoIdx = (ret, params) => {
    const idx = protos.findIndex(
      (p) =>
        p.ret === ret &&
        p.params.length === params.length &&
        p.params.every((x, i) => x === params[i])
    );
    if (idx < 0) throw new Error(`Missing proto: (${params.join('')})${ret}`);
    return idx;
  };

  // Methods sorted by class_idx, then name_idx, then proto_idx
  const methods = [
    { cls: 'Landroid/app/Activity;', name: '<init>', ret: 'V', params: [] },
    { cls: 'Landroid/app/Activity;', name: 'onCreate', ret: 'V', params: ['Landroid/os/Bundle;'] },
    { cls: 'Landroid/app/Activity;', name: 'setContentView', ret: 'V', params: ['Landroid/view/View;'] },
    { cls: 'Landroid/webkit/WebSettings;', name: 'setDomStorageEnabled', ret: 'V', params: ['Z'] },
    { cls: 'Landroid/webkit/WebSettings;', name: 'setJavaScriptEnabled', ret: 'V', params: ['Z'] },
    { cls: 'Landroid/webkit/WebSettings;', name: 'setMediaPlaybackRequiresUserGesture', ret: 'V', params: ['Z'] },
    { cls: 'Landroid/webkit/WebView;', name: '<init>', ret: 'V', params: ['Landroid/content/Context;'] },
    { cls: 'Landroid/webkit/WebView;', name: 'getSettings', ret: 'Landroid/webkit/WebSettings;', params: [] },
    { cls: 'Landroid/webkit/WebView;', name: 'loadUrl', ret: 'V', params: ['Ljava/lang/String;'] },
    { cls: 'Lcom/alehop/popitquickpush/MainActivity;', name: '<init>', ret: 'V', params: [] },
    { cls: 'Lcom/alehop/popitquickpush/MainActivity;', name: 'onCreate', ret: 'V', params: ['Landroid/os/Bundle;'] },
  ].sort((a, b) => {
    const cDiff = typeIdx(a.cls) - typeIdx(b.cls);
    if (cDiff !== 0) return cDiff;
    const nDiff = strIdx(a.name) - strIdx(b.name);
    if (nDiff !== 0) return nDiff;
    return protoIdx(a.ret, a.params) - protoIdx(b.ret, b.params);
  });

  const methodIdx = (cls, name) => {
    const idx = methods.findIndex((m) => m.cls === cls && m.name === name);
    if (idx < 0) throw new Error(`Missing method: ${cls}.${name}`);
    return idx;
  };

  function encodeUleb128(value) {
    const out = [];
    let v = value >>> 0;
    do {
      let byte = v & 0x7f;
      v >>>= 7;
      if (v !== 0) byte |= 0x80;
      out.push(byte);
    } while (v !== 0);
    return Buffer.from(out);
  }

  // Assemble sections with deterministic 4-byte alignment
  const chunks = [];
  let currentOffset = 0;

  function appendChunk(buf, align = 4) {
    if (align > 1 && currentOffset % align !== 0) {
      const pad = align - (currentOffset % align);
      chunks.push(Buffer.alloc(pad, 0));
      currentOffset += pad;
    }
    const start = currentOffset;
    chunks.push(buf);
    currentOffset += buf.length;
    return start;
  }

  // Reserve Header (0x70 bytes)
  const headerPos = appendChunk(Buffer.alloc(0x70, 0), 4);
  // Reserve string_ids (N * 4)
  const stringIdsPos = appendChunk(Buffer.alloc(rawStrings.length * 4, 0), 4);
  // Reserve type_ids (N * 4)
  const typeIdsPos = appendChunk(Buffer.alloc(typeDescriptors.length * 4, 0), 4);
  // Reserve proto_ids (N * 12)
  const protoIdsPos = appendChunk(Buffer.alloc(protos.length * 12, 0), 4);
  // Reserve method_ids (N * 8)
  const methodIdsPos = appendChunk(Buffer.alloc(methods.length * 8, 0), 4);
  // Reserve class_defs (1 * 32)
  const classDefsPos = appendChunk(Buffer.alloc(32, 0), 4);

  const dataSectionStart = currentOffset;

  // Type lists for protos that have parameters
  const protoTypeListOffsets = protos.map((p) => {
    if (p.params.length === 0) return 0;
    const b = Buffer.alloc(4 + p.params.length * 2);
    b.writeUInt32LE(p.params.length, 0);
    p.params.forEach((paramType, idx) => {
      b.writeUInt16LE(typeIdx(paramType), 4 + idx * 2);
    });
    return appendChunk(b, 4);
  });

  // Code item 1: MainActivity.<init>()V
  // invoke-direct {v0}, Landroid/app/Activity;.<init>:()V ; return-void
  const mActivityInit = methodIdx('Landroid/app/Activity;', '<init>');
  const initInsns = Buffer.alloc(8);
  initInsns.writeUInt16LE(0x1070, 0); // invoke-direct, count=1
  initInsns.writeUInt16LE(mActivityInit, 2);
  initInsns.writeUInt16LE(0x0000, 4); // {v0}
  initInsns.writeUInt16LE(0x000e, 6); // return-void

  const codeItemInit = Buffer.alloc(16 + initInsns.length);
  codeItemInit.writeUInt16LE(1, 0); // registers_size = 1
  codeItemInit.writeUInt16LE(1, 2); // ins_size = 1
  codeItemInit.writeUInt16LE(1, 4); // outs_size = 1
  codeItemInit.writeUInt16LE(0, 6); // tries_size = 0
  codeItemInit.writeUInt32LE(0, 8); // debug_info_off = 0
  codeItemInit.writeUInt32LE(initInsns.length / 2, 12); // insns_size in 16-bit code units
  initInsns.copy(codeItemInit, 16);
  const codeInitOffset = appendChunk(codeItemInit, 4);

  // Code item 2: MainActivity.onCreate(Landroid/os/Bundle;)V
  // Registers: v0=webView, v1=settings, v2=temp/bool/url, v3=this, v4=bundle
  const mSuperOnCreate = methodIdx('Landroid/app/Activity;', 'onCreate');
  const mWebViewInit = methodIdx('Landroid/webkit/WebView;', '<init>');
  const mGetSettings = methodIdx('Landroid/webkit/WebView;', 'getSettings');
  const mSetJs = methodIdx('Landroid/webkit/WebSettings;', 'setJavaScriptEnabled');
  const mSetDom = methodIdx('Landroid/webkit/WebSettings;', 'setDomStorageEnabled');
  const mSetMedia = methodIdx('Landroid/webkit/WebSettings;', 'setMediaPlaybackRequiresUserGesture');
  const mSetContentView = methodIdx('Landroid/app/Activity;', 'setContentView');
  const mLoadUrl = methodIdx('Landroid/webkit/WebView;', 'loadUrl');
  const tWebView = typeIdx('Landroid/webkit/WebView;');
  const sAssetUrl = strIdx('file:///android_asset/index.html');

  const u16List = [
    // invoke-super {v3, v4}, Activity.onCreate
    0x206f, mSuperOnCreate, 0x0043,
    // new-instance v0, Landroid/webkit/WebView;
    0x0022, tWebView,
    // invoke-direct {v0, v3}, WebView.<init>(Context)
    0x2070, mWebViewInit, 0x0030,
    // invoke-virtual {v0}, WebView.getSettings()
    0x106e, mGetSettings, 0x0000,
    // move-result-object v1
    0x010c,
    // const/4 v2, #1
    0x1212,
    // invoke-virtual {v1, v2}, WebSettings.setJavaScriptEnabled(true)
    0x206e, mSetJs, 0x0021,
    // invoke-virtual {v1, v2}, WebSettings.setDomStorageEnabled(true)
    0x206e, mSetDom, 0x0021,
    // const/4 v2, #0
    0x0212,
    // invoke-virtual {v1, v2}, WebSettings.setMediaPlaybackRequiresUserGesture(false)
    0x206e, mSetMedia, 0x0021,
    // invoke-virtual {v3, v0}, Activity.setContentView(v0)
    0x206e, mSetContentView, 0x0003,
    // const-string v2, "file:///android_asset/index.html"
    0x021a, sAssetUrl,
    // invoke-virtual {v0, v2}, WebView.loadUrl(v2)
    0x206e, mLoadUrl, 0x0020,
    // return-void
    0x000e,
  ];

  const onCreateInsns = Buffer.alloc(u16List.length * 2);
  u16List.forEach((val, idx) => onCreateInsns.writeUInt16LE(val, idx * 2));

  const codeItemOnCreate = Buffer.alloc(16 + onCreateInsns.length);
  codeItemOnCreate.writeUInt16LE(5, 0); // registers_size = 5
  codeItemOnCreate.writeUInt16LE(2, 2); // ins_size = 2 (v3=this, v4=bundle)
  codeItemOnCreate.writeUInt16LE(2, 4); // outs_size = 2
  codeItemOnCreate.writeUInt16LE(0, 6); // tries_size = 0
  codeItemOnCreate.writeUInt32LE(0, 8); // debug_info_off = 0
  codeItemOnCreate.writeUInt32LE(u16List.length, 12);
  onCreateInsns.copy(codeItemOnCreate, 16);
  const codeOnCreateOffset = appendChunk(codeItemOnCreate, 4);

  // String data items (MUTF-8: uleb128 utf16_size + bytes + 0x00)
  const stringDataOffsets = rawStrings.map((str) => {
    const utf8 = Buffer.from(str, 'utf8');
    const lenBuf = encodeUleb128(str.length);
    const item = Buffer.concat([lenBuf, utf8, Buffer.from([0x00])]);
    return appendChunk(item, 1);
  });

  // class_data_item for MainActivity
  const mMainInit = methodIdx('Lcom/alehop/popitquickpush/MainActivity;', '<init>');
  const mMainOnCreate = methodIdx('Lcom/alehop/popitquickpush/MainActivity;', 'onCreate');

  const classDataBuf = Buffer.concat([
    encodeUleb128(0), // static_fields_size = 0
    encodeUleb128(0), // instance_fields_size = 0
    encodeUleb128(1), // direct_methods_size = 1 (<init>)
    encodeUleb128(1), // virtual_methods_size = 1 (onCreate)
    // direct_method[0]: <init>, access = ACC_PUBLIC | ACC_CONSTRUCTOR (0x10001)
    encodeUleb128(mMainInit),
    encodeUleb128(0x10001),
    encodeUleb128(codeInitOffset),
    // virtual_method[0]: onCreate, access = ACC_PUBLIC (0x0001)
    encodeUleb128(mMainOnCreate),
    encodeUleb128(0x0001),
    encodeUleb128(codeOnCreateOffset),
  ]);
  const classDataOffset = appendChunk(classDataBuf, 1);

  // map_list (required at the end of the data section by DEX verifier)
  const mapPosition = currentOffset % 4 === 0 ? currentOffset : currentOffset + (4 - (currentOffset % 4));
  const mapEntries = [
    { type: 0x0000, count: 1, offset: 0 }, // TYPE_HEADER_ITEM
    { type: 0x0001, count: rawStrings.length, offset: stringIdsPos }, // TYPE_STRING_ID_ITEM
    { type: 0x0002, count: typeDescriptors.length, offset: typeIdsPos }, // TYPE_TYPE_ID_ITEM
    { type: 0x0003, count: protos.length, offset: protoIdsPos }, // TYPE_PROTO_ID_ITEM
    { type: 0x0005, count: methods.length, offset: methodIdsPos }, // TYPE_METHOD_ID_ITEM
    { type: 0x0006, count: 1, offset: classDefsPos }, // TYPE_CLASS_DEF_ITEM
    { type: 0x1001, count: protos.filter((p) => p.params.length > 0).length, offset: protoTypeListOffsets.find((o) => o > 0) }, // TYPE_TYPE_LIST
    { type: 0x2001, count: 2, offset: codeInitOffset }, // TYPE_CODE_ITEM
    { type: 0x2002, count: rawStrings.length, offset: stringDataOffsets[0] }, // TYPE_STRING_DATA_ITEM
    { type: 0x2000, count: 1, offset: classDataOffset }, // TYPE_CLASS_DATA_ITEM
    { type: 0x1000, count: 1, offset: mapPosition }, // TYPE_MAP_LIST
  ];

  const mapBuf = Buffer.alloc(4 + mapEntries.length * 12);
  mapBuf.writeUInt32LE(mapEntries.length, 0);
  mapEntries.forEach((m, i) => {
    const base = 4 + i * 12;
    mapBuf.writeUInt16LE(m.type, base);
    mapBuf.writeUInt16LE(0, base + 2);
    mapBuf.writeUInt32LE(m.count, base + 4);
    mapBuf.writeUInt32LE(m.offset, base + 8);
  });
  const actualMapOffset = appendChunk(mapBuf, 4);

  const fullDex = Buffer.concat(chunks);
  const fileSize = fullDex.length;
  const dataSize = fileSize - dataSectionStart;

  // Fill string_ids
  stringDataOffsets.forEach((off, idx) => {
    fullDex.writeUInt32LE(off, stringIdsPos + idx * 4);
  });

  // Fill type_ids
  typeDescriptors.forEach((desc, idx) => {
    fullDex.writeUInt32LE(strIdx(desc), typeIdsPos + idx * 4);
  });

  // Fill proto_ids
  protos.forEach((p, idx) => {
    const base = protoIdsPos + idx * 12;
    fullDex.writeUInt32LE(strIdx(p.shorty), base);
    fullDex.writeUInt32LE(typeIdx(p.ret), base + 4);
    fullDex.writeUInt32LE(protoTypeListOffsets[idx], base + 8);
  });

  // Fill method_ids
  methods.forEach((m, idx) => {
    const base = methodIdsPos + idx * 8;
    fullDex.writeUInt16LE(typeIdx(m.cls), base);
    fullDex.writeUInt16LE(protoIdx(m.ret, m.params), base + 2);
    fullDex.writeUInt32LE(strIdx(m.name), base + 4);
  });

  // Fill class_def for MainActivity
  fullDex.writeUInt32LE(typeIdx('Lcom/alehop/popitquickpush/MainActivity;'), classDefsPos + 0);
  fullDex.writeUInt32LE(0x0001, classDefsPos + 4); // ACC_PUBLIC
  fullDex.writeUInt32LE(typeIdx('Landroid/app/Activity;'), classDefsPos + 8); // superclass
  fullDex.writeUInt32LE(0, classDefsPos + 12); // interfaces_off
  fullDex.writeUInt32LE(0xffffffff, classDefsPos + 16); // source_file_idx = NO_INDEX
  fullDex.writeUInt32LE(0, classDefsPos + 20); // annotations_off
  fullDex.writeUInt32LE(classDataOffset, classDefsPos + 24); // class_data_off
  fullDex.writeUInt32LE(0, classDefsPos + 28); // static_values_off

  // Fill Header
  Buffer.from('dex\n035\0', 'ascii').copy(fullDex, 0);
  fullDex.writeUInt32LE(fileSize, 32);
  fullDex.writeUInt32LE(0x70, 36); // header_size
  fullDex.writeUInt32LE(0x12345678, 40); // ENDIAN_CONSTANT
  fullDex.writeUInt32LE(0, 44); // link_size
  fullDex.writeUInt32LE(0, 48); // link_off
  fullDex.writeUInt32LE(actualMapOffset, 52); // map_off
  fullDex.writeUInt32LE(rawStrings.length, 56);
  fullDex.writeUInt32LE(stringIdsPos, 60);
  fullDex.writeUInt32LE(typeDescriptors.length, 64);
  fullDex.writeUInt32LE(typeIdsPos, 68);
  fullDex.writeUInt32LE(protos.length, 72);
  fullDex.writeUInt32LE(protoIdsPos, 76);
  fullDex.writeUInt32LE(0, 80); // field_ids_size
  fullDex.writeUInt32LE(0, 84); // field_ids_off
  fullDex.writeUInt32LE(methods.length, 88);
  fullDex.writeUInt32LE(methodIdsPos, 92);
  fullDex.writeUInt32LE(1, 96); // class_defs_size
  fullDex.writeUInt32LE(classDefsPos, 100);
  fullDex.writeUInt32LE(dataSize, 104);
  fullDex.writeUInt32LE(dataSectionStart, 108);

  // Compute SHA-1 signature over bytes [32..fileSize)
  const sha1 = crypto.createHash('sha1').update(fullDex.slice(32)).digest();
  sha1.copy(fullDex, 12);

  // Compute Adler-32 checksum over bytes [12..fileSize)
  let a = 1;
  let b = 0;
  const MOD_ADLER = 65521;
  for (let i = 12; i < fullDex.length; i++) {
    a = (a + fullDex[i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  const adler = ((b << 16) | a) >>> 0;
  fullDex.writeUInt32LE(adler, 8);

  return fullDex;
}

// ---------------------------------------------------------------------------
// 2. BINARY ANDROIDMANIFEST.XML (AXML) GENERATOR
// ---------------------------------------------------------------------------
function buildBinaryManifest() {
  // Attribute strings with resource IDs MUST come first, sorted by resource ID
  const attrDefs = [
    { name: 'theme', id: 0x01010000 },
    { name: 'label', id: 0x01010001 },
    { name: 'icon', id: 0x01010002 },
    { name: 'name', id: 0x01010003 },
    { name: 'exported', id: 0x01010010 },
    { name: 'screenOrientation', id: 0x0101001e },
    { name: 'configChanges', id: 0x0101001f },
    { name: 'minSdkVersion', id: 0x0101020c },
    { name: 'versionCode', id: 0x0101021b },
    { name: 'versionName', id: 0x0101021c },
    { name: 'targetSdkVersion', id: 0x01010270 },
    { name: 'hardwareAccelerated', id: 0x010102d3 },
  ];

  const otherStrings = [
    'android',
    'http://schemas.android.com/apk/res/android',
    'manifest',
    'package',
    'com.alehop.popitquickpush',
    '1.4.0',
    'uses-permission',
    'android.permission.INTERNET',
    'uses-sdk',
    'application',
    'ALE-POP Quick Push',
    'activity',
    'com.alehop.popitquickpush.MainActivity',
    'intent-filter',
    'action',
    'android.intent.action.MAIN',
    'category',
    'android.intent.category.LAUNCHER',
  ];

  const allStrings = attrDefs.map((a) => a.name).concat(otherStrings);
  const sIdx = (s) => {
    const idx = allStrings.indexOf(s);
    if (idx < 0) throw new Error(`Missing AXML string: ${s}`);
    return idx;
  };

  // Encode UTF-16LE String Pool Chunk (0x0001)
  const encodedStrings = allStrings.map((str) => {
    const buf = Buffer.alloc(2 + str.length * 2 + 2);
    buf.writeUInt16LE(str.length, 0);
    for (let i = 0; i < str.length; i++) {
      buf.writeUInt16LE(str.charCodeAt(i), 2 + i * 2);
    }
    buf.writeUInt16LE(0, 2 + str.length * 2);
    return buf;
  });

  const offsetsBuf = Buffer.alloc(allStrings.length * 4);
  let strByteOffset = 0;
  encodedStrings.forEach((b, i) => {
    offsetsBuf.writeUInt32LE(strByteOffset, i * 4);
    strByteOffset += b.length;
  });

  const stringsConcat = Buffer.concat(encodedStrings);
  const padLen = (4 - (stringsConcat.length % 4)) % 4;
  const stringsAligned = Buffer.concat([stringsConcat, Buffer.alloc(padLen, 0)]);

  const stringPoolHeader = Buffer.alloc(28);
  const stringPoolTotalSize = 28 + offsetsBuf.length + stringsAligned.length;
  stringPoolHeader.writeUInt16LE(0x0001, 0); // RES_STRING_POOL_TYPE
  stringPoolHeader.writeUInt16LE(28, 2);
  stringPoolHeader.writeUInt32LE(stringPoolTotalSize, 4);
  stringPoolHeader.writeUInt32LE(allStrings.length, 8);
  stringPoolHeader.writeUInt32LE(0, 12); // styleCount
  stringPoolHeader.writeUInt32LE(0, 16); // flags (UTF-16)
  stringPoolHeader.writeUInt32LE(28 + offsetsBuf.length, 20); // stringsStart
  stringPoolHeader.writeUInt32LE(0, 24); // stylesStart

  const stringPoolChunk = Buffer.concat([stringPoolHeader, offsetsBuf, stringsAligned]);

  // Resource Map Chunk (0x0180)
  const resMapChunk = Buffer.alloc(8 + attrDefs.length * 4);
  resMapChunk.writeUInt16LE(0x0180, 0);
  resMapChunk.writeUInt16LE(8, 2);
  resMapChunk.writeUInt32LE(resMapChunk.length, 4);
  attrDefs.forEach((a, i) => {
    resMapChunk.writeUInt32LE(a.id, 8 + i * 4);
  });

  const NO_NS = 0xffffffff;
  const NS_ANDROID = sIdx('http://schemas.android.com/apk/res/android');

  function makeNamespaceChunk(isStart, line) {
    const b = Buffer.alloc(24);
    b.writeUInt16LE(isStart ? 0x0100 : 0x0101, 0);
    b.writeUInt16LE(16, 2);
    b.writeUInt32LE(24, 4);
    b.writeUInt32LE(line, 8);
    b.writeUInt32LE(0xffffffff, 12);
    b.writeUInt32LE(sIdx('android'), 16);
    b.writeUInt32LE(NS_ANDROID, 20);
    return b;
  }

  // Attribute helper: { ns, name, rawStr, type, data }
  // Types: 0x03 = STRING, 0x10 = INT_DEC, 0x11 = INT_HEX, 0x12 = INT_BOOLEAN, 0x01 = REFERENCE
  function makeStartElement(tagName, line, attrs) {
    const totalSize = 36 + attrs.length * 20;
    const b = Buffer.alloc(totalSize);
    b.writeUInt16LE(0x0102, 0); // RES_XML_START_ELEMENT_TYPE
    b.writeUInt16LE(16, 2);
    b.writeUInt32LE(totalSize, 4);
    b.writeUInt32LE(line, 8);
    b.writeUInt32LE(0xffffffff, 12);
    b.writeUInt32LE(NO_NS, 16);
    b.writeUInt32LE(sIdx(tagName), 20);
    b.writeUInt16LE(20, 24); // attributeStart
    b.writeUInt16LE(20, 26); // attributeSize
    b.writeUInt16LE(attrs.length, 28);
    b.writeUInt16LE(0, 30); // idIndex
    b.writeUInt16LE(0, 32); // classIndex
    b.writeUInt16LE(0, 34); // styleIndex

    attrs.forEach((a, idx) => {
      const off = 36 + idx * 20;
      b.writeUInt32LE(a.ns, off + 0);
      b.writeUInt32LE(sIdx(a.name), off + 4);
      b.writeUInt32LE(a.rawStr !== null ? sIdx(a.rawStr) : 0xffffffff, off + 8);
      b.writeUInt16LE(8, off + 12); // size of Res_value
      b.writeUInt8(0, off + 14); // res0
      b.writeUInt8(a.type, off + 15);
      b.writeUInt32LE(a.data >>> 0, off + 16);
    });
    return b;
  }

  function makeEndElement(tagName, line) {
    const b = Buffer.alloc(24);
    b.writeUInt16LE(0x0103, 0); // RES_XML_END_ELEMENT_TYPE
    b.writeUInt16LE(16, 2);
    b.writeUInt32LE(24, 4);
    b.writeUInt32LE(line, 8);
    b.writeUInt32LE(0xffffffff, 12);
    b.writeUInt32LE(NO_NS, 16);
    b.writeUInt32LE(sIdx(tagName), 20);
    return b;
  }

  const xmlNodes = [
    makeNamespaceChunk(true, 2),

    // <manifest android:versionCode="6" android:versionName="1.5.0" package="com.alehop.popitquickpush">
    makeStartElement('manifest', 2, [
      { ns: NS_ANDROID, name: 'versionCode', rawStr: null, type: 0x10, data: 6 },
      { ns: NS_ANDROID, name: 'versionName', rawStr: '1.4.0', type: 0x03, data: sIdx('1.4.0') },
      { ns: NO_NS, name: 'package', rawStr: 'com.alehop.popitquickpush', type: 0x03, data: sIdx('com.alehop.popitquickpush') },
    ]),

    // <uses-permission android:name="android.permission.INTERNET" />
    makeStartElement('uses-permission', 3, [
      { ns: NS_ANDROID, name: 'name', rawStr: 'android.permission.INTERNET', type: 0x03, data: sIdx('android.permission.INTERNET') },
    ]),
    makeEndElement('uses-permission', 3),

    // <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="33" />
    makeStartElement('uses-sdk', 3, [
      { ns: NS_ANDROID, name: 'minSdkVersion', rawStr: null, type: 0x10, data: 21 },
      { ns: NS_ANDROID, name: 'targetSdkVersion', rawStr: null, type: 0x10, data: 33 },
    ]),
    makeEndElement('uses-sdk', 3),

    // <application android:theme="@android:style/Theme.NoTitleBar.Fullscreen" android:label="ALE-POP Quick Push" android:icon="@android:drawable/sym_def_app_icon" android:hardwareAccelerated="true">
    makeStartElement('application', 4, [
      { ns: NS_ANDROID, name: 'theme', rawStr: null, type: 0x01, data: 0x01030007 },
      { ns: NS_ANDROID, name: 'label', rawStr: 'ALE-POP Quick Push', type: 0x03, data: sIdx('ALE-POP Quick Push') },
      { ns: NS_ANDROID, name: 'icon', rawStr: null, type: 0x01, data: 0x01080093 },
      { ns: NS_ANDROID, name: 'hardwareAccelerated', rawStr: null, type: 0x12, data: 0xffffffff },
    ]),

    // <activity android:theme="@android:style/Theme.NoTitleBar.Fullscreen" android:label="ALE-POP Quick Push" android:name="com.alehop.popitquickpush.MainActivity" android:exported="true" android:screenOrientation="sensor" android:configChanges="orientation|keyboardHidden|screenSize|screenLayout">
    makeStartElement('activity', 5, [
      { ns: NS_ANDROID, name: 'theme', rawStr: null, type: 0x01, data: 0x01030007 },
      { ns: NS_ANDROID, name: 'label', rawStr: 'ALE-POP Quick Push', type: 0x03, data: sIdx('ALE-POP Quick Push') },
      { ns: NS_ANDROID, name: 'name', rawStr: 'com.alehop.popitquickpush.MainActivity', type: 0x03, data: sIdx('com.alehop.popitquickpush.MainActivity') },
      { ns: NS_ANDROID, name: 'exported', rawStr: null, type: 0x12, data: 0xffffffff },
      { ns: NS_ANDROID, name: 'screenOrientation', rawStr: null, type: 0x10, data: 4 }, // sensor = 4 (auto portrait/landscape)
      { ns: NS_ANDROID, name: 'configChanges', rawStr: null, type: 0x11, data: 0x0da0 },
    ]),

    // <intent-filter>
    makeStartElement('intent-filter', 6, []),
    makeStartElement('action', 7, [
      { ns: NS_ANDROID, name: 'name', rawStr: 'android.intent.action.MAIN', type: 0x03, data: sIdx('android.intent.action.MAIN') },
    ]),
    makeEndElement('action', 7),
    makeStartElement('category', 8, [
      { ns: NS_ANDROID, name: 'name', rawStr: 'android.intent.category.LAUNCHER', type: 0x03, data: sIdx('android.intent.category.LAUNCHER') },
    ]),
    makeEndElement('category', 8),
    makeEndElement('intent-filter', 6),

    makeEndElement('activity', 5),
    makeEndElement('application', 4),
    makeEndElement('manifest', 2),
    makeNamespaceChunk(false, 2),
  ];

  const body = Buffer.concat([stringPoolChunk, resMapChunk, ...xmlNodes]);
  const axmlHeader = Buffer.alloc(8);
  axmlHeader.writeUInt16LE(0x0003, 0); // RES_XML_TYPE
  axmlHeader.writeUInt16LE(8, 2);
  axmlHeader.writeUInt32LE(8 + body.length, 4);

  return Buffer.concat([axmlHeader, body]);
}

// ---------------------------------------------------------------------------
// 3. MINIMAL RESOURCES.ARSC GENERATOR (4-BYTE ALIGNED)
// ---------------------------------------------------------------------------
function buildMinimalResourcesArsc() {
  // Valid ResTable_header + ResTable_package with typeStrings and keyStrings pools
  const emptyPool = Buffer.alloc(28, 0);
  emptyPool.writeUInt16LE(0x0001, 0); // RES_STRING_POOL_TYPE
  emptyPool.writeUInt16LE(28, 2); // headerSize
  emptyPool.writeUInt32LE(28, 4); // size
  emptyPool.writeUInt32LE(28, 20); // stringsStart

  const pkgHeaderSize = 288;
  const pkgSize = pkgHeaderSize + 28 + 28;
  const totalSize = 12 + pkgSize;
  const buf = Buffer.alloc(12 + pkgHeaderSize, 0);

  // ResTable_header (12 bytes)
  buf.writeUInt16LE(0x0002, 0); // RES_TABLE_TYPE
  buf.writeUInt16LE(12, 2); // headerSize
  buf.writeUInt32LE(totalSize, 4); // size
  buf.writeUInt32LE(1, 8); // packageCount = 1

  // ResTable_package (288 bytes header)
  const pOff = 12;
  buf.writeUInt16LE(0x0200, pOff + 0); // RES_TABLE_PACKAGE_TYPE
  buf.writeUInt16LE(pkgHeaderSize, pOff + 2); // headerSize
  buf.writeUInt32LE(pkgSize, pOff + 4); // size
  buf.writeUInt32LE(0x7f, pOff + 8); // id = 0x7f
  const pkgName = 'com.alehop.popitquickpush';
  for (let i = 0; i < pkgName.length; i++) {
    buf.writeUInt16LE(pkgName.charCodeAt(i), pOff + 12 + i * 2);
  }
  buf.writeUInt32LE(pkgHeaderSize, pOff + 268); // typeStrings offset = 288
  buf.writeUInt32LE(0, pOff + 272); // lastPublicType
  buf.writeUInt32LE(pkgHeaderSize + 28, pOff + 276); // keyStrings offset = 316
  buf.writeUInt32LE(0, pOff + 280); // lastPublicKey
  buf.writeUInt32LE(0, pOff + 284); // typeIdOffset

  return Buffer.concat([buf, emptyPool, emptyPool]);
}

// ---------------------------------------------------------------------------
// 4. ASN.1 DER & X.509 / PKCS#7 HELPER FOR V1 & V2 SIGNING
// ---------------------------------------------------------------------------
function asn1Len(len) {
  if (len < 128) return Buffer.from([len]);
  const hex = len.toString(16).padStart(len > 255 ? 4 : 2, '0');
  const bytes = Buffer.from(hex, 'hex');
  return Buffer.concat([Buffer.from([0x80 | bytes.length]), bytes]);
}

function asn1Tag(tagByte, contentBuf) {
  return Buffer.concat([Buffer.from([tagByte]), asn1Len(contentBuf.length), contentBuf]);
}

function asn1Seq(...items) {
  return asn1Tag(0x30, Buffer.concat(items));
}

function asn1Set(...items) {
  return asn1Tag(0x31, Buffer.concat(items));
}

function asn1Oid(oidBytes) {
  return asn1Tag(0x06, Buffer.from(oidBytes));
}

function asn1Int(intBuf) {
  let b = Buffer.isBuffer(intBuf) ? intBuf : Buffer.from([intBuf]);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
  return asn1Tag(0x02, b);
}

function createSelfSignedCertAndKey() {
  const keyFilePath = path.join(__dirname, '.apk-signing-key.json');
  let publicKey;
  let privateKey;

  if (fs.existsSync(keyFilePath)) {
    const saved = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
    publicKey = Buffer.from(saved.publicKeyDerBase64, 'base64');
    privateKey = saved.privateKeyPem;
  } else {
    const generated = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    fs.writeFileSync(
      keyFilePath,
      JSON.stringify(
        {
          publicKeyDerBase64: publicKey.toString('base64'),
          privateKeyPem: privateKey,
        },
        null,
        2
      )
    );
  }

  // OIDs
  const oidSha256WithRsa = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b];
  const oidCommonName = [0x55, 0x04, 0x03];

  const algIdSha256Rsa = asn1Seq(asn1Oid(oidSha256WithRsa), Buffer.from([0x05, 0x00]));
  const cnAttr = asn1Set(
    asn1Seq(asn1Oid(oidCommonName), asn1Tag(0x0c, Buffer.from('ALE-POP Android Release', 'utf8')))
  );
  const nameSeq = asn1Seq(cnAttr);

  const validity = asn1Seq(
    asn1Tag(0x17, Buffer.from('250101000000Z', 'ascii')),
    asn1Tag(0x17, Buffer.from('491231235959Z', 'ascii'))
  );

  const serialBuf = Buffer.from([0x01, 0x42, 0x99, 0x11]);
  const tbsCert = asn1Seq(
    asn1Tag(0xa0, asn1Int(2)), // v3
    asn1Int(serialBuf),
    algIdSha256Rsa,
    nameSeq,
    validity,
    nameSeq,
    publicKey
  );

  const sig = crypto.sign('sha256', tbsCert, privateKey);
  const sigBitString = asn1Tag(0x03, Buffer.concat([Buffer.from([0x00]), sig]));
  const certDer = asn1Seq(tbsCert, algIdSha256Rsa, sigBitString);

  return { certDer, publicKeySpkiDer: publicKey, privateKeyPem: privateKey, nameSeq, serialBuf };
}

function createPkcs7Signature(sfContent, certInfo) {
  const oidSignedData = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02];
  const oidData = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01];
  const oidSha256 = [0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];
  const oidRsaEncryption = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];

  const algSha256 = asn1Seq(asn1Oid(oidSha256), Buffer.from([0x05, 0x00]));
  const algRsa = asn1Seq(asn1Oid(oidRsaEncryption), Buffer.from([0x05, 0x00]));

  const signature = crypto.sign('sha256', sfContent, certInfo.privateKeyPem);

  const signerInfo = asn1Seq(
    asn1Int(1),
    asn1Seq(certInfo.nameSeq, asn1Int(certInfo.serialBuf)),
    algSha256,
    algRsa,
    asn1Tag(0x04, signature)
  );

  const signedData = asn1Seq(
    asn1Int(1),
    asn1Set(algSha256),
    asn1Seq(asn1Oid(oidData)),
    asn1Tag(0xa0, certInfo.certDer),
    asn1Set(signerInfo)
  );

  return asn1Seq(asn1Oid(oidSignedData), asn1Tag(0xa0, signedData));
}

// ---------------------------------------------------------------------------
// 5. ZIP & APK SIGNATURE SCHEME V2 PACKAGER
// ---------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function computeApkV2Digest(beforeCentralDir, centralDir, eocdWithUpdatedOffset) {
  const CHUNK_SIZE = 1048576; // 1 MB
  const chunkDigests = [];

  for (const section of [beforeCentralDir, centralDir, eocdWithUpdatedOffset]) {
    let offset = 0;
    while (offset < section.length) {
      const slice = section.slice(offset, Math.min(section.length, offset + CHUNK_SIZE));
      const prefix = Buffer.alloc(5);
      prefix[0] = 0xa5;
      prefix.writeUInt32LE(slice.length, 1);
      const d = crypto.createHash('sha256').update(prefix).update(slice).digest();
      chunkDigests.push(d);
      offset += CHUNK_SIZE;
    }
  }

  const topPrefix = Buffer.alloc(5);
  topPrefix[0] = 0x5a;
  topPrefix.writeUInt32LE(chunkDigests.length, 1);
  return crypto
    .createHash('sha256')
    .update(topPrefix)
    .update(Buffer.concat(chunkDigests))
    .digest();
}

function u32Prefixed(buf) {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length, 0);
  return Buffer.concat([len, buf]);
}

function buildApkSigningBlockV2(digestSha256, certInfo) {
  // Algorithm ID: 0x0103 = RSASSA-PKCS1-v1_5 with SHA256
  const algIdBuf = Buffer.alloc(4);
  algIdBuf.writeUInt32LE(0x0103, 0);

  const digestEntry = u32Prefixed(Buffer.concat([algIdBuf, u32Prefixed(digestSha256)]));
  const digestsSeq = u32Prefixed(digestEntry);

  const certsSeq = u32Prefixed(u32Prefixed(certInfo.certDer));
  const additionalAttrsSeq = u32Prefixed(Buffer.alloc(0));

  const signedData = Buffer.concat([
    digestsSeq,
    certsSeq,
    additionalAttrsSeq,
    Buffer.alloc(4, 0), // Play Store / v2 optional trailing empty uint32
  ]);

  // Wait: in APK Signature Scheme v2, signed_data has exactly 3 length-prefixed fields:
  // digests, certificates, additional_attributes!
  const exactSignedData = Buffer.concat([digestsSeq, certsSeq, additionalAttrsSeq]);

  const signatureBytes = crypto.sign('sha256', exactSignedData, certInfo.privateKeyPem);
  const signatureEntry = u32Prefixed(Buffer.concat([algIdBuf, u32Prefixed(signatureBytes)]));
  const signaturesSeq = u32Prefixed(signatureEntry);

  const signer = u32Prefixed(
    Buffer.concat([
      u32Prefixed(exactSignedData),
      signaturesSeq,
      u32Prefixed(certInfo.publicKeySpkiDer),
    ])
  );

  const signersSeq = u32Prefixed(signer);

  // Pair: uint64_le(size of id + value), uint32_le(0x7109871a), value
  const pairValue = signersSeq;
  const pairLen = 4 + pairValue.length;
  const pairHeader = Buffer.alloc(12);
  pairHeader.writeBigUInt64LE(BigInt(pairLen), 0);
  pairHeader.writeUInt32LE(0x7109871a, 8);
  const pairBuf = Buffer.concat([pairHeader, pairValue]);

  // Total block size must be a multiple of 4096 (or padded with a dummy pair / standard 8-byte alignment)
  // Block layout: uint64_le(size_of_block_excluding_first_8_bytes), pairs..., uint64_le(same_size), "APK Sig Block 42"
  const blockSizeField = BigInt(pairBuf.length + 8 + 16);
  const headSize = Buffer.alloc(8);
  headSize.writeBigUInt64LE(blockSizeField, 0);
  const tailSize = Buffer.alloc(8);
  tailSize.writeBigUInt64LE(blockSizeField, 0);
  const magic = Buffer.from('APK Sig Block 42', 'ascii');

  return Buffer.concat([headSize, pairBuf, tailSize, magic]);
}

function buildApk() {
  const htmlContent = fs.readFileSync(path.join(__dirname, 'mobile-preview.html'));
  // Keep index.html synchronized for Apple iOS PWA on GitHub Pages
  fs.writeFileSync(path.join(__dirname, 'index.html'), htmlContent);
  const manifestBin = buildBinaryManifest();
  const resourcesArsc = buildMinimalResourcesArsc();
  const classesDex = buildClassesDex();

  const certInfo = createSelfSignedCertAndKey();

  // Build v1 JAR Signature files (MANIFEST.MF, CERT.SF, CERT.RSA)
  const payloadFiles = [
    { name: 'AndroidManifest.xml', data: manifestBin, storeOnly: false },
    { name: 'resources.arsc', data: resourcesArsc, storeOnly: true, align4: true },
    { name: 'classes.dex', data: classesDex, storeOnly: false },
    { name: 'assets/index.html', data: htmlContent, storeOnly: false },
  ];

  let manifestMf = 'Manifest-Version: 1.0\r\nCreated-By: 1.0 (Android)\r\n\r\n';
  const entrySections = [];
  payloadFiles.forEach((f) => {
    const hashB64 = crypto.createHash('sha256').update(f.data).digest('base64');
    const sec = `Name: ${f.name}\r\nSHA-256-Digest: ${hashB64}\r\n\r\n`;
    manifestMf += sec;
    entrySections.push({ name: f.name, section: sec });
  });

  const manifestMfBuf = Buffer.from(manifestMf, 'utf8');
  const mainDigest = crypto.createHash('sha256').update(manifestMfBuf).digest('base64');

  let certSf = `Signature-Version: 1.0\r\nCreated-By: 1.0 (Android)\r\nSHA-256-Digest-Manifest: ${mainDigest}\r\n\r\n`;
  entrySections.forEach((es) => {
    const secDigest = crypto.createHash('sha256').update(Buffer.from(es.section, 'utf8')).digest('base64');
    certSf += `Name: ${es.name}\r\nSHA-256-Digest: ${secDigest}\r\n\r\n`;
  });
  const certSfBuf = Buffer.from(certSf, 'utf8');
  const certRsaBuf = createPkcs7Signature(certSfBuf, certInfo);

  const allFiles = [
    ...payloadFiles,
    { name: 'META-INF/MANIFEST.MF', data: manifestMfBuf, storeOnly: false },
    { name: 'META-INF/CERT.SF', data: certSfBuf, storeOnly: false },
    { name: 'META-INF/CERT.RSA', data: certRsaBuf, storeOnly: false },
  ];

  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  allFiles.forEach((file) => {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.data);
    const compressed = file.storeOnly ? file.data : zlib.deflateRawSync(file.data);
    const method = file.storeOnly ? 0 : 8;

    // 4-byte alignment padding in Extra Field for uncompressed resources.arsc (required by Android 11+)
    let extraLen = 0;
    if (file.align4) {
      const dataStart = offset + 30 + nameBuf.length;
      extraLen = (4 - (dataStart % 4)) % 4;
    }
    const extraBuf = Buffer.alloc(extraLen, 0);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0x0000, 10); // mod time
    localHeader.writeUInt16LE(0x0021, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(extraBuf.length, 28);

    const localRecord = Buffer.concat([localHeader, nameBuf, extraBuf, compressed]);
    localHeaders.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0x0000, 12);
    centralHeader.writeUInt16LE(0x0021, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra len in CD
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    centralHeaders.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localRecord.length;
  });

  const beforeCentralDir = Buffer.concat(localHeaders);
  const centralDir = Buffer.concat(centralHeaders);

  const eocdForDigest = Buffer.alloc(22);
  eocdForDigest.writeUInt32LE(0x06054b50, 0);
  eocdForDigest.writeUInt16LE(0, 4);
  eocdForDigest.writeUInt16LE(0, 6);
  eocdForDigest.writeUInt16LE(allFiles.length, 8);
  eocdForDigest.writeUInt16LE(allFiles.length, 10);
  eocdForDigest.writeUInt32LE(centralDir.length, 12);
  eocdForDigest.writeUInt32LE(beforeCentralDir.length, 16); // points to start of APK Signing Block during digest
  eocdForDigest.writeUInt16LE(0, 20);

  const v2Digest = computeApkV2Digest(beforeCentralDir, centralDir, eocdForDigest);
  const apkSigningBlock = buildApkSigningBlockV2(v2Digest, certInfo);

  // Final EOCD points to Central Directory AFTER the APK Signing Block
  const finalEocd = Buffer.from(eocdForDigest);
  finalEocd.writeUInt32LE(beforeCentralDir.length + apkSigningBlock.length, 16);

  const finalApk = Buffer.concat([beforeCentralDir, apkSigningBlock, centralDir, finalEocd]);
  const outPath = path.join(__dirname, 'ALE-POP-QuickPush.apk');
  fs.writeFileSync(outPath, finalApk);
  console.log(`APK generado correctamente: ${outPath} (${finalApk.length} bytes)`);
}

buildApk();

/**
 * PostHog session-replay payload profiler.
 *
 * Paste into the devtools console on the editor (before or after granting
 * analytics consent), use the app for a while, then call:
 *
 *   await __phProfile.probe()  // is THIS session's board recording black? (live)
 *   __phProfile.report()     // byte breakdown by rrweb event kind
 *   __phProfile.canvases()   // per-canvas bytes (board vs minimap vs watch)
 *   __phProfile.timeline()   // when a canvas went blank / came alive, and why
 *   __phProfile.requests()   // per-request wire size + compression ratio
 *   __phProfile.mutations()  // deepest offenders inside DOM mutations
 *   __phProfile.json()       // all of the above as one JSON-safe object
 *   __phProfile.reset()
 *   __phProfile.stop()
 *
 * To hand the numbers to someone else use `json()` — `raw` holds `Map`s, and
 * `JSON.stringify` turns those into `{}`.
 *
 * Arm it BEFORE consent is granted (paste, then reload if analytics is already
 * accepted): the full snapshot is sent once at recording start and is the only
 * thing that maps rrweb node ids to elements — miss it and `canvases()` can
 * only report `unresolved#<id>`.
 *
 * Intercepts fetch / XHR / sendBeacon, keeps only PostHog ingestion requests,
 * inflates whatever layer of gzip+base64 the payload arrived in, and tallies
 * serialized bytes per rrweb event type — and for incremental snapshots, per
 * mutation source. `canvasMutation` dominating means canvas capture is on in the
 * PostHog project settings; `mutation` dominating points at DOM churn.
 */
(() => {
  if (globalThis.__phProfile) globalThis.__phProfile.stop();

  const RRWEB_TYPE = {
    0: 'domContentLoaded',
    1: 'load',
    2: 'fullSnapshot',
    3: 'incremental',
    4: 'meta',
    5: 'custom',
    6: 'plugin'
  };

  const SOURCE = {
    0: 'mutation',
    1: 'mouseMove',
    2: 'mouseInteraction',
    3: 'scroll',
    4: 'viewportResize',
    5: 'input',
    6: 'touchMove',
    7: 'mediaInteraction',
    8: 'styleSheetRule',
    9: 'canvasMutation',
    10: 'font',
    11: 'log',
    12: 'drag',
    13: 'styleDeclaration',
    14: 'selection',
    15: 'adoptedStyleSheet',
    16: 'customElement'
  };

  const stats = new Map();
  const mutationTargets = new Map();
  const canvasStats = new Map();
  const canvasCommands = new Map();
  const requests = [];

  /**
   * Blank↔live transitions per canvas, plus the recorder-level events worth
   * correlating them against. A canvas that goes blank and stays blank is a
   * state change, not a race, so the moment it flips is the evidence: the
   * timeline puts it next to any recording restart (a second full snapshot),
   * viewport resize, or metadata change that landed at the same instant.
   */
  const timeline = [];
  let firstEventAt = null;

  /**
   * rrweb node id → a human label, harvested from the full snapshot and from
   * mutation `adds`. `canvasMutation` events only carry the id, so without this
   * the board and the minimap are indistinguishable in the breakdown.
   */
  const idToLabel = new Map();
  /** rrweb node id → latest canvas backing size, for the blank-frame test. */
  const idToDims = new Map();

  const bump = (map, key, bytes) => {
    const entry = map.get(key) ?? { count: 0, bytes: 0, worst: 0 };
    entry.count++;
    entry.bytes += bytes;
    entry.worst = Math.max(entry.worst, bytes);
    map.set(key, entry);
  };

  const isPosthog = (url) => {
    if (typeof url !== 'string') return false;
    return /u\.logigator\.com|i\.posthog\.com/.test(url);
  };

  const pathOf = (url) => {
    try {
      return new URL(url, location.href).pathname;
    } catch {
      return url;
    }
  };

  /** Byte length of whatever a body turned out to be, before any decoding. */
  const wireBytes = async (body) => {
    if (body == null) return 0;
    if (typeof body === 'string') return new Blob([body]).size;
    if (body instanceof Blob) return body.size;
    if (body instanceof ArrayBuffer) return body.byteLength;
    if (ArrayBuffer.isView(body)) return body.byteLength;
    if (body instanceof FormData) {
      let total = 0;
      for (const [k, v] of body.entries())
        total += k.length + (typeof v === 'string' ? v.length : (v?.size ?? 0));
      return total;
    }
    try {
      return new Blob([body]).size;
    } catch {
      return 0;
    }
  };

  const inflate = async (bytes, format) => {
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream(format));
    return new Response(stream).text();
  };

  /** Tries every compression PostHog may have applied, innermost last. */
  const toText = async (body) => {
    let bytes = null;
    if (typeof body === 'string') {
      const trimmed = body.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) return trimmed;
      // `data=<base64>` form encoding, or bare base64.
      const raw = trimmed.startsWith('data=')
        ? decodeURIComponent(trimmed.slice(5))
        : trimmed;
      try {
        bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      } catch {
        return trimmed;
      }
    } else if (body instanceof Blob) {
      bytes = new Uint8Array(await body.arrayBuffer());
    } else if (body instanceof ArrayBuffer) {
      bytes = new Uint8Array(body);
    } else if (ArrayBuffer.isView(body)) {
      bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    } else if (body instanceof FormData) {
      const data = body.get('data');
      return typeof data === 'string' ? toText(data) : null;
    } else {
      return null;
    }

    // Already plain JSON?
    const head = new TextDecoder().decode(bytes.slice(0, 1));
    if (head === '[' || head === '{') return new TextDecoder().decode(bytes);

    for (const format of ['gzip', 'deflate', 'deflate-raw']) {
      try {
        return await inflate(bytes, format);
      } catch {
        /* try the next one */
      }
    }
    return null;
  };

  /** Absolute floor below which no encoded picture fits, whatever the canvas:
   * a solid-colour or transparent frame lands here at any size. */
  const BLANK_PAYLOAD_FLOOR = 600;
  /**
   * Bytes of encoded image per megapixel of backing store, below which a frame
   * cannot be carrying a drawn picture. Real frames of this app's canvases run
   * thousands of B/MP; an empty frame runs tens. Judging by area rather than by
   * the canvas's own best frame is what makes a *uniformly* blank session
   * detectable — the case that matters most, and the one a
   * share-of-best-frame rule structurally cannot see.
   */
  const BLANK_BYTES_PER_MEGAPIXEL = 1000;
  /** Only when a canvas's backing size was never captured: fall back to judging
   * frames against the best one seen, which needs a live frame to exist. */
  const BLANK_PAYLOAD_RATIO = 0.15;
  const MAX_TRACKED_FRAMES = 20000;

  const megapixels = (dims) => (dims ? (dims.w * dims.h) / 1e6 : null);

  /**
   * Classifies a canvas's frames blank-or-live and derives the transitions
   * between the two. Done at print time, once every frame and every backing-size
   * update has been seen.
   */
  const classify = (entry, dims) => {
    const frames = entry.frames ?? [];
    const best = frames.reduce((m, f) => Math.max(m, f.payload), 0);
    const mp = megapixels(dims);
    const isBlank = (payload) => {
      if (payload < BLANK_PAYLOAD_FLOOR) return true;
      if (mp) return payload / mp < BLANK_BYTES_PER_MEGAPIXEL;
      return payload < best * BLANK_PAYLOAD_RATIO;
    };
    const threshold = mp
      ? Math.round(mp * BLANK_BYTES_PER_MEGAPIXEL)
      : Math.max(BLANK_PAYLOAD_FLOOR, Math.round(best * BLANK_PAYLOAD_RATIO));
    const transitions = [];
    let blank = 0;
    let state = null;
    for (const frame of frames) {
      const next = isBlank(frame.payload) ? 'blank' : 'live';
      if (next === 'blank') blank++;
      if (next !== state) {
        transitions.push({
          at: frame.at,
          to: next,
          detail: `${frame.payload} B payload${state ? ` (was ${state})` : ' (first frame)'}`
        });
        state = next;
      }
    }
    return {
      best,
      threshold,
      blank,
      transitions,
      payload: frames.reduce((s, f) => s + f.payload, 0)
    };
  };

  /** Recognises this app's canvases by the classes they're authored with. */
  const KNOWN_CANVASES = [
    { match: /touch-none/, name: 'board' },
    { match: /inset-0 h-full w-full$/, name: 'minimap' },
    { match: /block h-full w-full/, name: 'watch' }
  ];

  const describeNode = (node) => {
    const tag = node?.tagName;
    if (!tag) return null;
    const attrs = node.attributes ?? {};
    const className = typeof attrs.class === 'string' ? attrs.class : '';
    if (tag === 'canvas') {
      const known = KNOWN_CANVASES.find((c) => c.match.test(className));
      const size =
        attrs.width && attrs.height ? ` ${attrs.width}×${attrs.height}` : '';
      return `canvas:${known?.name ?? 'unknown'}${size}`;
    }
    const id = attrs.id ? `#${attrs.id}` : '';
    const cls = className
      ? `.${className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    return `${tag}${id}${cls}`;
  };

  /** Records id → label, and for canvases id → backing size, for every element
   * in a serialized rrweb subtree. */
  const harvestLabels = (node) => {
    if (!node || typeof node !== 'object') return;
    const label = describeNode(node);
    if (label != null && node.id != null) {
      idToLabel.set(node.id, label);
      noteDims(node.id, node.tagName, node.attributes);
    }
    for (const child of node.childNodes ?? []) harvestLabels(child);
  };

  /** A canvas's backing store changes with the window and the DPR, and rrweb
   * reports that as a plain attribute mutation — track the latest. */
  const noteDims = (id, tagName, attrs) => {
    if (tagName !== undefined && tagName !== 'canvas') return;
    const w = Number(attrs?.width);
    const h = Number(attrs?.height);
    if (w > 0 && h > 0) idToDims.set(id, { w, h });
  };

  const labelFor = (id) => idToLabel.get(id) ?? `unresolved#${id}`;

  /** Largest embedded string in an event — for a canvas snapshot that's the
   * image payload itself, so it separates real pixels from bookkeeping. */
  const biggestString = (value, best = 0) => {
    if (typeof value === 'string') return Math.max(best, value.length);
    if (Array.isArray(value)) {
      for (const item of value) best = biggestString(item, best);
      return best;
    }
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) best = biggestString(item, best);
      return best;
    }
    return best;
  };

  const sizeOf = (value) => {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 0;
    }
  };

  /** Tallies one rrweb event into `stats`, drilling into mutations. Returns the
   * event's serialized size so the request can report its expanded total. */
  const tallySnapshotEvent = (event) => {
    const bytes = sizeOf(event);
    const kind = RRWEB_TYPE[event?.type] ?? `type:${event?.type}`;

    const at = typeof event?.timestamp === 'number' ? event.timestamp : null;

    if (event?.type === 2) {
      harvestLabels(event.data?.node);
      bump(stats, kind, bytes);
      // A second full snapshot means the recorder restarted — the prime suspect
      // for a canvas that changes state and stays there.
      const nth = stats.get('fullSnapshot')?.count ?? 1;
      noteTimeline(
        at,
        'fullSnapshot',
        nth > 1 ? `#${nth} — recorder restarted` : '#1'
      );
      return bytes;
    }
    if (event?.type === 4) {
      bump(stats, kind, bytes);
      noteTimeline(at, 'meta', `${event.data?.width}×${event.data?.height}`);
      return bytes;
    }
    if (event?.type === 3) {
      const source =
        SOURCE[event.data?.source] ?? `source:${event.data?.source}`;
      bump(stats, `incremental/${source}`, bytes);
      if (event.data?.source === 0) tallyMutation(event.data);
      if (event.data?.source === 4)
        noteTimeline(
          at,
          'viewportResize',
          `${event.data?.width}×${event.data?.height}`
        );
      if (event.data?.source === 9) tallyCanvas(event.data, bytes, at);
      return bytes;
    }
    if (event?.type === 5 || event?.type === 6) {
      const tag = event.data?.tag ?? event.data?.plugin ?? 'unknown';
      bump(stats, `${kind}/${tag}`, bytes);
      return bytes;
    }
    bump(stats, kind, bytes);
    return bytes;
  };

  const noteTimeline = (at, what, detail, canvasId) => {
    if (at != null) firstEventAt ??= at;
    timeline.push({ at, what, detail, canvasId });
  };

  /**
   * Splits canvas bytes per canvas element, and within one canvas per drawing
   * command. `payload kB` is the largest embedded string — the encoded image —
   * so a canvas that records as a blank frame shows up as near-zero payload
   * even while its event count stays high.
   *
   * Keyed by rrweb node id, never by label: requests decode concurrently, so
   * the mutation that introduced a canvas can be tallied *after* the frames
   * drawn on it. Labels are resolved when a table is printed, by which point
   * every snapshot and mutation has been seen.
   */
  const tallyCanvas = (data, bytes, at) => {
    bump(canvasStats, data.id, bytes);
    const entry = canvasStats.get(data.id);
    entry.frames ??= [];
    if (entry.frames.length < MAX_TRACKED_FRAMES)
      entry.frames.push({ at, payload: biggestString(data) });
    for (const command of data.commands ?? [])
      bump(canvasCommands, `${data.id} ${command.property}`, sizeOf(command));
    if (!data.commands) bump(canvasCommands, `${data.id} snapshot`, bytes);
  };

  /** Attributes DOM-mutation bytes to the node kinds actually being churned. */
  const tallyMutation = (data) => {
    for (const add of data.adds ?? []) harvestLabels(add.node);
    for (const add of data.adds ?? [])
      bump(
        mutationTargets,
        `add:${add.node?.tagName ?? (add.node?.type === 3 ? '#text' : add.node?.type)}`,
        sizeOf(add)
      );
    for (const attr of data.attributes ?? [])
      if (idToDims.has(attr.id)) noteDims(attr.id, undefined, attr.attributes);
    for (const attr of data.attributes ?? [])
      bump(
        mutationTargets,
        `attr:${Object.keys(attr.attributes ?? {}).join(',') || '?'}`,
        sizeOf(attr)
      );
    for (const text of data.texts ?? [])
      bump(mutationTargets, 'text', sizeOf(text));
    if (data.removes?.length)
      bump(mutationTargets, 'remove', sizeOf(data.removes));
  };

  const record = async (url, body) => {
    const path = pathOf(url);
    const wire = await wireBytes(body);
    // `body` is the outer request after decompression; `expanded` also counts
    // the second gzip layer inside `$snapshot_data`, which is where the bulk is.
    const entry = { path, wire, body: 0, expanded: 0, events: 0, snapshots: 0 };
    requests.push(entry);

    const text = await toText(body);
    if (!text) return;
    entry.body = new Blob([text]).size;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }

    // `/e/` sends `{api_key, batch: [...]}`; `/s/` sends a bare array.
    const batch = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.batch)
        ? parsed.batch
        : [parsed];
    entry.events = batch.length;

    for (const item of batch) {
      const name = item?.event ?? 'unknown';
      if (name !== '$snapshot') {
        // Non-replay events land here — kept so the two streams are comparable.
        const bytes = sizeOf(item);
        bump(stats, `event:${name}`, bytes);
        entry.expanded += bytes;
        continue;
      }
      entry.snapshots++;
      let snapshotData = item.properties?.['$snapshot_data'];
      // Snapshot data itself may be a second, inner gzip+base64 layer.
      if (snapshotData && !Array.isArray(snapshotData)) {
        const inner = await toText(snapshotData.data ?? snapshotData).catch(
          () => null
        );
        if (inner) {
          try {
            snapshotData = JSON.parse(inner);
          } catch {
            /* leave as-is */
          }
        }
      }
      if (!Array.isArray(snapshotData)) {
        const bytes = sizeOf(item);
        bump(stats, 'snapshot/undecodable', bytes);
        entry.expanded += bytes;
        continue;
      }
      for (const event of snapshotData)
        entry.expanded += tallySnapshotEvent(event);
    }
  };

  const safeRecord = (url, body) => {
    // Never let profiling break the app it is profiling.
    Promise.resolve()
      .then(() => record(url, body))
      .catch(() => undefined);
  };

  const originalFetch = globalThis.fetch;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalBeacon = navigator.sendBeacon?.bind(navigator);

  globalThis.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input?.url;
      if (isPosthog(url)) {
        const body = init?.body ?? (input instanceof Request ? null : null);
        if (body != null) safeRecord(url, body);
        else if (input instanceof Request)
          input
            .clone()
            .blob()
            .then((b) => safeRecord(url, b))
            .catch(() => undefined);
      }
    } catch {
      /* fall through to the real fetch */
    }
    return originalFetch.apply(this, arguments);
  };

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__phUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (isPosthog(this.__phUrl) && body != null)
        safeRecord(this.__phUrl, body);
    } catch {
      /* fall through */
    }
    return originalSend.apply(this, arguments);
  };

  if (originalBeacon) {
    navigator.sendBeacon = function (url, data) {
      try {
        if (isPosthog(url) && data != null) safeRecord(url, data);
      } catch {
        /* fall through */
      }
      return originalBeacon(url, data);
    };
  }

  const kb = (bytes) => +(bytes / 1024).toFixed(1);

  const table = (map, totalOverride, keyLabel = (key) => key) => {
    const total =
      totalOverride ?? [...map.values()].reduce((s, e) => s + e.bytes, 0);
    return [...map.entries()]
      .sort((a, b) => b[1].bytes - a[1].bytes)
      .map(([key, e]) => ({
        kind: keyLabel(key),
        count: e.count,
        'kB total': kb(e.bytes),
        'kB worst': kb(e.worst),
        '% of decoded': total ? +((e.bytes / total) * 100).toFixed(1) : 0
      }));
  };

  const canvasRows = () => {
    const total = [...canvasStats.values()].reduce((s, e) => s + e.bytes, 0);
    return [...canvasStats.entries()]
      .sort((a, b) => b[1].bytes - a[1].bytes)
      .map(([id, e]) => {
        const dims = idToDims.get(id);
        const c = classify(e, dims);
        return {
          canvas: labelFor(id),
          backing: dims ? `${dims.w}×${dims.h}` : '?',
          frames: e.count,
          blank: `${c.blank}/${e.count}`,
          'blank if under B': c.threshold,
          'kB total': kb(e.bytes),
          'kB worst frame': kb(e.worst),
          'kB payload': kb(c.payload),
          'kB best payload': kb(c.best),
          'bytes/frame': Math.round(e.bytes / e.count),
          '% of canvas': total ? +((e.bytes / total) * 100).toFixed(1) : 0
        };
      });
  };

  /** Recorder events merged with every canvas's derived blank↔live flips. */
  const timelineRows = () =>
    [
      ...timeline,
      ...[...canvasStats.entries()].flatMap(([id, e]) =>
        classify(e, idToDims.get(id)).transitions.map((t) => ({
          at: t.at,
          what: `→ ${t.to}`,
          detail: t.detail,
          canvasId: id
        }))
      )
    ]
      .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
      .map((t) => ({
        'at (s)':
          t.at != null && firstEventAt != null
            ? +((t.at - firstEventAt) / 1000).toFixed(1)
            : '?',
        clock: t.at != null ? new Date(t.at).toLocaleTimeString() : '?',
        what: t.canvasId != null ? `${labelFor(t.canvasId)} ${t.what}` : t.what,
        detail: t.detail
      }));

  const liveLabel = (canvas) => {
    const known = KNOWN_CANVASES.find((c) => c.match.test(canvas.className));
    return `canvas:${known?.name ?? 'unknown'}`;
  };

  /**
   * Reads every canvas in the DOM the two ways a recorder can, right now:
   * `toDataURL` and the `createImageBitmap` → `OffscreenCanvas.convertToBlob`
   * path rrweb uses for sampled snapshots. Needs neither PostHog nor consent,
   * and answers immediately — no waiting for a replay to be processed.
   *
   * A board whose bytes land near the blank floor is a session that will replay
   * black. Which of the two columns fails also localises the cause: both tiny
   * means the canvas genuinely holds no pixels; `toDataURL` fat while the worker
   * path is tiny or throws means the capture path is the problem, not the board.
   */
  const probeCanvases = async () => {
    const rows = [];
    for (const canvas of document.querySelectorAll('canvas')) {
      const mp = (canvas.width * canvas.height) / 1e6;
      const row = {
        canvas: liveLabel(canvas),
        backing: `${canvas.width}×${canvas.height}`,
        MP: +mp.toFixed(2),
        css: `${Math.round(canvas.clientWidth)}×${Math.round(canvas.clientHeight)}`,
        attached: document.contains(canvas)
      };
      let bytes = null;
      try {
        // A data URL is base64, so ~1.37× the encoded bytes — irrelevant next to
        // the two orders of magnitude that separate a drawn frame from an empty
        // one.
        row['toDataURL B'] = Math.round(
          canvas.toDataURL('image/webp', 0.4).length / 1.37
        );
      } catch (err) {
        row['toDataURL B'] = `⚠ ${err.name}`;
      }
      try {
        const bitmap = await createImageBitmap(canvas);
        const off = new OffscreenCanvas(bitmap.width, bitmap.height);
        off.getContext('2d').drawImage(bitmap, 0, 0);
        const blob = await off.convertToBlob({
          type: 'image/webp',
          quality: 0.4
        });
        bitmap.close();
        bytes = blob.size;
        row['worker path B'] = bytes;
      } catch (err) {
        row['worker path B'] = `⚠ ${err.name}`;
      }
      row.verdict =
        typeof bytes !== 'number'
          ? 'capture failed'
          : bytes < BLANK_PAYLOAD_FLOOR ||
              (mp && bytes / mp < BLANK_BYTES_PER_MEGAPIXEL)
            ? 'BLANK'
            : 'live';
      rows.push(row);
    }
    // eslint-disable-next-line no-console
    console.table(rows);
    return rows;
  };

  globalThis.__phProfile = {
    probe: probeCanvases,
    report() {
      const decoded = [...stats.values()].reduce((s, e) => s + e.bytes, 0);
      const wire = requests.reduce((s, r) => s + r.wire, 0);
      // eslint-disable-next-line no-console
      console.log(
        `${requests.length} PostHog requests · ${kb(wire)} kB on the wire · ` +
          `${kb(decoded)} kB decoded (${wire ? (decoded / wire).toFixed(1) : '?'}× compression)`
      );
      // eslint-disable-next-line no-console
      console.table(table(stats, decoded));
      return { wireBytes: wire, decodedBytes: decoded };
    },
    mutations() {
      // eslint-disable-next-line no-console
      console.table(table(mutationTargets));
    },
    /** Which canvas costs what, and whether its frames carry real pixels. */
    canvases() {
      // eslint-disable-next-line no-console
      console.table(canvasRows());
      // Command keys are `<node id> <property>`; resolve the id half now.
      // eslint-disable-next-line no-console
      console.table(
        table(canvasCommands, undefined, (key) => {
          const [id, ...rest] = key.split(' ');
          return `${labelFor(Number(id))} · ${rest.join(' ')}`;
        })
      );
    },
    requests() {
      // eslint-disable-next-line no-console
      console.table(
        [...requests]
          .sort((a, b) => b.wire - a.wire)
          .map((r) => ({
            path: r.path,
            'kB wire': kb(r.wire),
            'kB body': kb(r.body),
            'kB expanded': kb(r.expanded),
            events: r.events,
            snapshots: r.snapshots
          }))
      );
    },
    /** When each canvas went blank or came alive, against recorder events. */
    timeline() {
      // eslint-disable-next-line no-console
      console.table(timelineRows());
    },
    /**
     * Everything, as a plain object safe to `JSON.stringify` and paste
     * elsewhere. The `raw` maps below are `Map`s, which stringify to `{}` — use
     * this instead of `raw` whenever the numbers have to leave the console.
     */
    json() {
      const decoded = [...stats.values()].reduce((s, e) => s + e.bytes, 0);
      const wire = requests.reduce((s, r) => s + r.wire, 0);
      const byPath = {};
      for (const r of requests) {
        const p = (byPath[r.path] ??= { count: 0, wire: 0, decoded: 0 });
        p.count++;
        p.wire += r.wire;
        p.decoded += r.expanded || r.body;
      }
      return {
        summary: { requests: requests.length, wire, decoded, byPath },
        events: table(stats, decoded),
        canvases: canvasRows(),
        canvasCommands: table(canvasCommands, undefined, (key) => {
          const [id, ...rest] = key.split(' ');
          return `${labelFor(Number(id))} · ${rest.join(' ')}`;
        }),
        mutations: table(mutationTargets),
        timeline: timelineRows(),
        labels: Object.fromEntries(idToLabel)
      };
    },
    /**
     * Same content as {@link json}, plus the request log. A getter returning
     * plain objects rather than the underlying `Map`s: dumping this is the
     * obvious thing to reach for, and `JSON.stringify` renders a `Map` as `{}` —
     * so exposing the maps here loses every table to a silent empty object.
     */
    get raw() {
      return { ...this.json(), requests };
    },
    /** The live maps, for poking at in the console. Not JSON-serializable. */
    maps: {
      stats,
      mutationTargets,
      canvasStats,
      canvasCommands,
      idToLabel,
      idToDims,
      timeline
    },
    reset() {
      stats.clear();
      mutationTargets.clear();
      canvasStats.clear();
      canvasCommands.clear();
      requests.length = 0;
      timeline.length = 0;
      firstEventAt = null;
      // `idToLabel` is deliberately kept: the full snapshot that populated it
      // arrives once per recording and won't be re-sent after a reset.
    },
    stop() {
      globalThis.fetch = originalFetch;
      XMLHttpRequest.prototype.send = originalSend;
      XMLHttpRequest.prototype.open = originalOpen;
      if (originalBeacon) navigator.sendBeacon = originalBeacon;
      delete globalThis.__phProfile;
    }
  };

  // eslint-disable-next-line no-console
  console.log(
    'PostHog profiler armed. Use the editor, then call __phProfile.report()'
  );
})();

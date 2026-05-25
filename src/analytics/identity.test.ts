import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** RFC-4122 shape check — good enough to confirm `crypto.randomUUID` output. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Re-import `identity.ts` with a clean module registry so module-level state
 * — the `loadId` constant and the session-id cache — is reset. Each call
 * models a fresh page/app load.
 */
async function loadIdentity() {
  vi.resetModules();
  return import("./identity");
}

/** Define an own property on `navigator`, shadowing any prototype value. */
function stubNav(prop: string, value: unknown): void {
  Object.defineProperty(navigator, prop, {
    value,
    configurable: true,
    writable: true,
  });
}

/** Override `document.referrer` for the current test. */
function stubReferrer(value: string): void {
  Object.defineProperty(document, "referrer", { value, configurable: true });
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  // Drop any per-test overrides so they cannot leak into the next test.
  Reflect.deleteProperty(navigator, "doNotTrack");
  Reflect.deleteProperty(navigator, "globalPrivacyControl");
  Reflect.deleteProperty(document, "referrer");
});

describe("loadId", () => {
  it("is a UUID", async () => {
    const m = await loadIdentity();
    expect(m.loadId).toMatch(UUID_RE);
  });

  it("is freshly minted on every load", async () => {
    const first = (await loadIdentity()).loadId;
    const second = (await loadIdentity()).loadId;
    expect(second).not.toBe(first);
  });
});

describe("getSessionId", () => {
  it("returns a UUID", async () => {
    const m = await loadIdentity();
    expect(m.getSessionId()).toMatch(UUID_RE);
  });

  it("is stable within a single load", async () => {
    const m = await loadIdentity();
    expect(m.getSessionId()).toBe(m.getSessionId());
  });

  it("persists across loads via sessionStorage", async () => {
    const first = (await loadIdentity()).getSessionId();
    // A second fresh module models a reload within the same tab/session.
    const second = (await loadIdentity()).getSessionId();
    expect(second).toBe(first);
  });

  it("differs from loadId", async () => {
    const m = await loadIdentity();
    expect(m.getSessionId()).not.toBe(m.loadId);
  });

  it("falls back to a stable in-memory id when sessionStorage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const m = await loadIdentity();
    const a = m.getSessionId();
    const b = m.getSessionId();
    expect(a).toMatch(UUID_RE);
    expect(b).toBe(a);
  });
});

describe("getSessionRef", () => {
  it("pairs the session id with this load's loadId", async () => {
    const m = await loadIdentity();
    const ref = m.getSessionRef();
    expect(ref.id).toBe(m.getSessionId());
    expect(ref.loadId).toBe(m.loadId);
  });
});

describe("isDoNotTrack", () => {
  it("is false with no privacy signal", async () => {
    const m = await loadIdentity();
    expect(m.isDoNotTrack()).toBe(false);
  });

  it("is true when navigator.doNotTrack === '1'", async () => {
    stubNav("doNotTrack", "1");
    const m = await loadIdentity();
    expect(m.isDoNotTrack()).toBe(true);
  });

  it("is false when navigator.doNotTrack is '0'", async () => {
    stubNav("doNotTrack", "0");
    const m = await loadIdentity();
    expect(m.isDoNotTrack()).toBe(false);
  });

  it("is true when navigator.globalPrivacyControl === true", async () => {
    stubNav("globalPrivacyControl", true);
    const m = await loadIdentity();
    expect(m.isDoNotTrack()).toBe(true);
  });

  it("is true when the in-app opt-out preference is set", async () => {
    localStorage.setItem("pf.analytics.opt_out", "1");
    const m = await loadIdentity();
    expect(m.isDoNotTrack()).toBe(true);
  });

  it("is false when the in-app preference is cleared and no browser signal is set", async () => {
    localStorage.setItem("pf.analytics.opt_out", "1");
    localStorage.removeItem("pf.analytics.opt_out");
    const m = await loadIdentity();
    expect(m.isDoNotTrack()).toBe(false);
  });
});

describe("getReferrerHost", () => {
  it("returns '' when there is no referrer", async () => {
    const m = await loadIdentity();
    expect(m.getReferrerHost()).toBe("");
  });

  it("returns the host only, dropping path/query/fragment", async () => {
    stubReferrer("https://news.example.com/path?q=1#frag");
    const m = await loadIdentity();
    expect(m.getReferrerHost()).toBe("news.example.com");
  });

  it("keeps a non-default port", async () => {
    stubReferrer("https://example.com:8443/x");
    const m = await loadIdentity();
    expect(m.getReferrerHost()).toBe("example.com:8443");
  });

  it("returns '' for an unparseable referrer", async () => {
    stubReferrer("not a url");
    const m = await loadIdentity();
    expect(m.getReferrerHost()).toBe("");
  });
});

describe("getClientContext", () => {
  it("captures ua, lang, viewport, tier and dnt", async () => {
    const m = await loadIdentity();
    const ctx = m.getClientContext();
    expect(ctx.ua).toBe(navigator.userAgent);
    expect(ctx.lang).toBe(navigator.language);
    expect(ctx.viewport).toEqual({
      w: window.innerWidth,
      h: window.innerHeight,
    });
    expect(["high", "medium", "low"]).toContain(ctx.tier);
    expect(typeof ctx.dnt).toBe("boolean");
  });

  it("reflects the privacy signal in dnt", async () => {
    stubNav("globalPrivacyControl", true);
    const m = await loadIdentity();
    expect(m.getClientContext().dnt).toBe(true);
  });
});

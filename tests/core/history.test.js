import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  contentHash,
  createVaultHistory,
  MAX_CHAIN_LENGTH,
} from "../../src/core/history.js";

function makeMockAdapter() {
  const store = {};
  return {
    read: vi.fn(async (path) => {
      if (path in store) return store[path];
      throw new Error(`File not found: ${path}`);
    }),
    write: vi.fn(async (path, data) => {
      store[path] = data;
    }),
    exists: vi.fn(async (path) => path in store),
    mkdir: vi.fn(async () => {}),
    list: vi.fn(async (path) => {
      const files = Object.keys(store).filter(
        (k) => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/")
      );
      return { files, folders: [] };
    }),
    _store: store,
  };
}

function makeRunRecord(runId, findings = []) {
  return {
    run_id: runId,
    timestamp: "2026-03-28T20:07:36",
    slug: "test-note",
    content_hash: "abc123",
    word_count: 100,
    model: "test-model",
    personas_run: ["TestPersona"],
    parent_run_id: null,
    metadata: {},
    findings,
    persona_verdicts: [],
  };
}

describe("contentHash", () => {
  it("returns a hex string", async () => {
    const hash = await contentHash("hello world");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns same hash for same input", async () => {
    const a = await contentHash("test");
    const b = await contentHash("test");
    expect(a).toBe(b);
  });

  it("returns different hash for different input", async () => {
    const a = await contentHash("test1");
    const b = await contentHash("test2");
    expect(a).not.toBe(b);
  });
});

describe("createVaultHistory", () => {
  let adapter;
  let history;
  const basePath = ".first-misread";
  const contentId = "Drafts/my-post";

  beforeEach(() => {
    adapter = makeMockAdapter();
    history = createVaultHistory(adapter, basePath);
  });

  it("resolveParent returns null when no history exists", async () => {
    const result = await history.resolveParent(contentId);
    expect(result).toBeNull();
  });

  it("saveRun writes run record and input text", async () => {
    const record = makeRunRecord("run-20260328-200736");
    await history.saveRun(contentId, record, "My draft text");

    expect(adapter.mkdir).toHaveBeenCalled();
    expect(adapter.write).toHaveBeenCalledTimes(3);

    const writeCalls = adapter.write.mock.calls;
    const runCall = writeCalls.find((c) => c[0].includes("run-20260328-200736.json"));
    const inputCall = writeCalls.find((c) => c[0].includes("input-run-20260328-200736.md"));
    expect(runCall).toBeDefined();
    expect(inputCall).toBeDefined();
    expect(inputCall[1]).toBe("My draft text");
  });

  it("resolveParent returns most recent record after saveRun", async () => {
    const record = makeRunRecord("run-20260328-200736");
    await history.saveRun(contentId, record, "text");

    const parent = await history.resolveParent(contentId);
    expect(parent).not.toBeNull();
    expect(parent.run_id).toBe("run-20260328-200736");
  });

  it("loadChain returns runs in chronological order", async () => {
    const r1 = makeRunRecord("run-001");
    const r2 = makeRunRecord("run-002");
    await history.saveRun(contentId, r1, "v1");
    await history.saveRun(contentId, r2, "v2");

    const chain = await history.loadChain(contentId);
    expect(chain).toHaveLength(2);
    expect(chain[0].run_id).toBe("run-001");
    expect(chain[1].run_id).toBe("run-002");
  });

  it("loadChain caps at MAX_CHAIN_LENGTH", async () => {
    for (let i = 0; i < MAX_CHAIN_LENGTH + 2; i++) {
      await history.saveRun(contentId, makeRunRecord(`run-${i}`), `v${i}`);
    }

    const chain = await history.loadChain(contentId);
    expect(chain.length).toBeLessThanOrEqual(MAX_CHAIN_LENGTH);
  });

  it("loadInput returns saved input text", async () => {
    await history.saveRun(contentId, makeRunRecord("run-001"), "Draft text here");
    const input = await history.loadInput(contentId, "run-001");
    expect(input).toBe("Draft text here");
  });

  it("loadInput returns null for unknown run", async () => {
    const input = await history.loadInput(contentId, "nonexistent");
    expect(input).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { diffFindings } from "../../src/core/differ.js";

function makeFinding(passage, severity = "medium", personas = ["TestPersona"]) {
  return {
    passage,
    location: "paragraph 1",
    severity,
    personas,
    descriptions: [{ persona: personas[0], what_happened: "test" }],
  };
}

function makeRunRecord(findings, runId = "run-001") {
  return {
    run_id: runId,
    timestamp: "2026-03-28T20:07:36",
    slug: "test-slug",
    content_hash: "abc123",
    word_count: 100,
    model: "test-model",
    personas_run: ["TestPersona"],
    parent_run_id: null,
    metadata: {
      wordCount: 100,
      estimatedReadTimeMinutes: 0.5,
      paragraphCount: 1,
      headingCount: 0,
      hasLists: false,
      hasLinks: false,
      sentenceCount: 1,
      avgSentenceLength: 10,
    },
    findings,
    persona_verdicts: [],
  };
}

describe("diffFindings", () => {
  it("marks all findings as new when chain is empty", () => {
    const current = [makeFinding("This is confusing")];
    const result = diffFindings(current, []);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("new");
    expect(result[0].current_finding.passage).toBe("This is confusing");
    expect(result[0].parent_finding).toBeNull();
  });

  it("marks matching findings as persists", () => {
    const current = [makeFinding("This passage is unclear")];
    const parent = makeRunRecord([makeFinding("This passage is unclear")]);
    const result = diffFindings(current, [parent]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("persists");
    expect(result[0].current_finding.passage).toBe("This passage is unclear");
    expect(result[0].parent_finding.passage).toBe("This passage is unclear");
  });

  it("marks unmatched parent findings as resolved", () => {
    const current = [];
    const parent = makeRunRecord([makeFinding("Old issue now fixed")]);
    const result = diffFindings(current, [parent]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("resolved");
    expect(result[0].parent_finding.passage).toBe("Old issue now fixed");
    expect(result[0].current_finding).toBeNull();
  });

  it("marks genuinely new findings as new when parent exists", () => {
    const current = [makeFinding("Brand new problem")];
    const parent = makeRunRecord([makeFinding("Completely different issue")]);
    const result = diffFindings(current, [parent]);
    const newFindings = result.filter((d) => d.status === "new");
    expect(newFindings).toHaveLength(1);
    expect(newFindings[0].current_finding.passage).toBe("Brand new problem");
  });

  it("detects regressed findings (absent in parent, present in ancestor)", () => {
    const ancestor = makeRunRecord(
      [makeFinding("This old bug came back")],
      "run-001"
    );
    const parent = makeRunRecord([], "run-002");
    const current = [makeFinding("This old bug came back")];
    const result = diffFindings(current, [ancestor, parent]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("regressed");
  });

  it("computes severity change for persisted findings", () => {
    const current = [makeFinding("Some issue", "high")];
    const parent = makeRunRecord([makeFinding("Some issue", "low")]);
    const result = diffFindings(current, [parent]);
    expect(result[0].severity_change).toBe("escalated");
  });

  it("computes persona count change", () => {
    const current = [
      makeFinding("Some issue", "medium", ["PersonaA", "PersonaB"]),
    ];
    const parent = makeRunRecord([
      makeFinding("Some issue", "medium", ["PersonaA"]),
    ]);
    const result = diffFindings(current, [parent]);
    expect(result[0].persona_count_change).toBe(1);
  });

  it("computes run streak for consecutive appearances", () => {
    const run1 = makeRunRecord([makeFinding("Persistent issue")], "run-001");
    const run2 = makeRunRecord([makeFinding("Persistent issue")], "run-002");
    const current = [makeFinding("Persistent issue")];
    const result = diffFindings(current, [run1, run2]);
    const persists = result.find((d) => d.status === "persists");
    expect(persists.run_streak).toBeGreaterThanOrEqual(3);
  });
});

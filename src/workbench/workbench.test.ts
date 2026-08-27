import { describe, expect, it } from "vitest";
import type { CaptureEntry } from "../db/captureLog";
import { analyzeCapture, groupCaptures, summarizeGroup } from "./analysis";
import { diffLines } from "./diff";
const entry = (
  id: string,
  code: string,
  at: number,
  verdict?: string,
): CaptureEntry => ({
  captureId: id,
  platform: "leetcode-cn",
  problemKey: "two-sum",
  title: "两数之和",
  canonicalUrl: "https://leetcode.cn/problems/two-sum/",
  accountKey: "anonymous",
  language: "python",
  code,
  codeHash: `hash-${id}`,
  captureMethod: "editor-model",
  captureConfidence: "high",
  submittedAt: at,
  sourceUrl: "https://leetcode.cn/problems/two-sum/",
  issues: [],
  idempotencyKey: id,
  verdict,
  createdAt: at,
  updatedAt: at,
});
describe("workbench pure functions", () => {
  it("groups by platform and problem, sorting submissions", () => {
    const groups = groupCaptures([
      entry("cap-0002", "b", 2),
      entry("cap-0001", "a", 1),
      { ...entry("cap-0003", "c", 3), platform: "leetcode-com" },
    ]);
    expect(groups).toHaveLength(2);
    expect(
      groups
        .find((g) => g.platform === "leetcode-cn")
        ?.submissions.map((x) => x.captureId),
    ).toEqual(["cap-0001", "cap-0002"]);
  });
  it("creates deterministic, explicitly local analysis and summary", () => {
    const previous = entry("cap-0001", "a", 1, "wrong_answer");
    const current = entry("cap-0002", "abc", 2, "accepted");
    const result = analyzeCapture(current, previous);
    expect(result.facts.join(" ")).toContain("增加 2");
    expect(result.limitations.join(" ")).toContain("不是 AI");
    expect(summarizeGroup(groupCaptures([previous, current])[0]!)).toContain(
      "2 次提交",
    );
  });
  it("collapses duplicate pending and terminal captures from the same submission", () => {
    const pending = {
      ...entry("cap-pending", "code", 100_000),
      codeHash: "same-hash",
    };
    const accepted = {
      ...entry("cap-accepted", "code", 95_000, "accepted"),
      codeHash: "same-hash",
      accountKey: "real-user",
    };
    const submissions = groupCaptures([pending, accepted])[0]?.submissions;
    expect(submissions).toHaveLength(1);
    expect(submissions?.[0]?.verdict).toBe("accepted");
  });
  it("produces line additions and removals", () => {
    const diff = diffLines("a\nb", "a\nc");
    expect(diff.map((x) => x.kind)).toEqual(["same", "added", "removed"]);
    expect(diff.find((x) => x.kind === "added")?.text).toBe("c");
  });
});

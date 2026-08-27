import type { CaptureEntry } from "../db/captureLog";
import type { Platform } from "../adapters/types";
export interface CaptureGroup {
  key: string;
  platform: Platform;
  problemKey: string;
  title: string;
  submissions: CaptureEntry[];
  latestAt: number;
}
function collapseDuplicateSubmissions(entries: CaptureEntry[]): CaptureEntry[] {
  const sorted = [...entries].sort((a, b) => a.submittedAt - b.submittedAt);
  const result: CaptureEntry[] = [];
  for (const entry of sorted) {
    const duplicate = [...result]
      .reverse()
      .find(
        (item) =>
          item.codeHash === entry.codeHash &&
          Math.abs(item.submittedAt - entry.submittedAt) < 30_000,
      );
    if (!duplicate) {
      result.push(entry);
      continue;
    }
    if (entry.verdict && !duplicate.verdict)
      Object.assign(duplicate, {
        ...entry,
        captureId: duplicate.captureId,
        submittedAt: Math.min(duplicate.submittedAt, entry.submittedAt),
      });
  }
  return result;
}
export function groupCaptures(
  entries: readonly CaptureEntry[],
): CaptureGroup[] {
  const map = new Map<string, CaptureGroup>();
  for (const entry of entries) {
    const key = `${entry.platform}:${entry.problemKey}`;
    const group = map.get(key) ?? {
      key,
      platform: entry.platform,
      problemKey: entry.problemKey,
      title: entry.title,
      submissions: [],
      latestAt: entry.submittedAt,
    };
    group.submissions.push(entry);
    group.latestAt = Math.max(group.latestAt, entry.submittedAt);
    if (entry.submittedAt === group.latestAt) group.title = entry.title;
    map.set(key, group);
  }
  return [...map.values()]
    .map((group) => {
      const submissions = collapseDuplicateSubmissions(group.submissions);
      return {
        ...group,
        submissions,
        latestAt: Math.max(...submissions.map((item) => item.submittedAt)),
      };
    })
    .sort((a, b) => b.latestAt - a.latestAt);
}
export interface LocalAnalysis {
  headline: string;
  facts: string[];
  limitations: string[];
}
export function analyzeCapture(
  current: CaptureEntry,
  previous?: CaptureEntry,
): LocalAnalysis {
  const lines = current.code.split("\n").length;
  const facts = [
    `本次采集到 ${current.code.length} 个字符、${lines} 行代码。`,
    `采集方式为 ${current.captureMethod}，完整性置信度为 ${current.captureConfidence}。`,
    `判题状态：${current.verdict ?? "尚未记录终态"}。`,
  ];
  if (previous) {
    const delta = current.code.length - previous.code.length;
    facts.push(
      `相对上次提交，代码字符数${delta === 0 ? "没有变化" : delta > 0 ? `增加 ${delta}` : `减少 ${Math.abs(delta)}`}。`,
    );
    facts.push(
      `状态演进：${previous.verdict ?? "无终态"} → ${current.verdict ?? "无终态"}。`,
    );
  }
  return {
    headline:
      current.verdict === "accepted"
        ? "本次提交已通过终态判题"
        : "本次提交尚未通过终态判题",
    facts,
    limitations: [
      "仅根据本地捕获字段确定性生成，不是 AI 分析。",
      "时间复杂度与空间复杂度待后续 AI 能力接入。",
    ],
  };
}
export function summarizeGroup(group: CaptureGroup): string {
  const accepted = group.submissions.filter(
    (item) => item.verdict === "accepted",
  ).length;
  const languages = [
    ...new Set(group.submissions.map((item) => item.language || "未知语言")),
  ];
  return `${group.submissions.length} 次提交，${accepted} 次通过，使用 ${languages.join("、")}；最近状态为 ${group.submissions.at(-1)?.verdict ?? "尚无终态"}。`;
}

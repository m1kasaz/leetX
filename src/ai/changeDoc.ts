// 解析"最小改动 diff"分析结果：{ code, changes:[{code, reason}] }
export interface AnalysisChange { code: string; reason: string }

export interface ChangeDoc { code: string; changes: AnalysisChange[] }

export function parseChangeDoc(value: unknown): ChangeDoc {
  const doc = (value ?? {}) as Record<string, unknown>;
  const code = typeof doc.code === 'string' ? doc.code.replace(/^\n+/, '').replace(/\s+$/, '') : '';
  const changes: AnalysisChange[] = [];
  if (Array.isArray(doc.changes)) {
    for (const item of doc.changes) {
      const entry = (item ?? {}) as Record<string, unknown>;
      const line = typeof entry.code === 'string' ? entry.code.trim() : '';
      const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
      if (line && reason) changes.push({ code: line, reason });
    }
  }
  return { code, changes };
}

// 改动行（trim 后）→ 解释，用于 diff 中给新增行挂悬浮提示；同内容行只取第一条
export function tipMap(changes: readonly AnalysisChange[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const change of changes) {
    if (!map.has(change.code)) map.set(change.code, change.reason);
  }
  return map;
}

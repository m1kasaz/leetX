// 把 AI 分析 JSON 压平成"手写笔记"结构：一段引言 + 一串要点 + 代码块
export interface NoteChange { code: string; reason: string }
export interface NoteDoc { lead: string; bullets: string[]; code: string; changes: NoteChange[] }

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
const asChanges = (value: unknown): NoteChange[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const entry = item as { code?: unknown; reason?: unknown } | null;
        const code = asString(entry?.code);
        const reason = asString(entry?.reason);
        return code && reason ? [{ code, reason }] : [];
      })
    : [];

const preferredListFields = ['coreIdea', 'issues', 'improvements', 'strengths', 'risks', 'suggestions'];
const consumedFields = new Set([
  'summary', 'overall', 'conclusion', 'problemUnderstanding', 'code', 'complexity', 'exampleValidation', 'changes',
  ...preferredListFields,
]);

export function toNoteDoc(value: unknown): NoteDoc {
  const doc = (value ?? {}) as Record<string, unknown>;
  const lead = asString(doc.summary) || asString(doc.overall) || asString(doc.conclusion);

  const bullets: string[] = [];
  if (asString(doc.problemUnderstanding)) bullets.push(asString(doc.problemUnderstanding));
  const listKeys = [
    ...preferredListFields,
    ...Object.keys(doc).filter((key) => !consumedFields.has(key) && Array.isArray(doc[key])),
  ];
  for (const key of listKeys) bullets.push(...asList(doc[key]));
  for (const [key, item] of Object.entries(doc)) {
    if (!consumedFields.has(key) && typeof item === 'string' && item.trim()) bullets.push(item.trim());
  }
  const complexity = asString(doc.complexity);
  if (complexity) bullets.push(`复杂度：${complexity}`);
  const validation = asString(doc.exampleValidation);
  if (validation) bullets.push(validation);

  return { lead, bullets, code: asString(doc.code), changes: asChanges(doc.changes) };
}

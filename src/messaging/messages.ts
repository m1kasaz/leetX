import { z } from 'zod';
export const MAX_CODE_LENGTH = 200_000;
export const platformSchema = z.enum(['leetcode-cn', 'leetcode-com', 'luogu']);
export const verdictSchema = z.enum(['pending','accepted','wrong_answer','time_limit_exceeded','memory_limit_exceeded','runtime_error','compile_error','output_limit_exceeded','cancelled','unknown']);
export const captureSubmitSchema = z.object({
  type:z.literal('leetx/capture-submit'), captureId:z.string().min(8), platform:platformSchema, problemKey:z.string().min(1), title:z.string(), canonicalUrl:z.string().url(), accountKey:z.string().min(1), language:z.string(), code:z.string().min(1).max(MAX_CODE_LENGTH), codeHash:z.string().min(8), captureMethod:z.enum(['editor-model','textarea','rendered-code','manual']), captureConfidence:z.enum(['high','medium','low']), submittedAt:z.number().int().positive(), sourceUrl:z.string().url(), issues:z.array(z.string())
});
export const captureVerdictSchema = z.object({ type:z.literal('leetx/capture-verdict'), captureId:z.string().min(8), verdict:verdictSchema.exclude(['pending']), rawVerdict:z.string().min(1), runtimeText:z.string().optional(), memoryText:z.string().optional(), errorSummary:z.string().max(2000).optional(), observedAt:z.number().int().positive() });
export const captureIssueSchema = z.object({ type:z.literal('leetx/capture-issue'), platform:platformSchema, reason:z.string().min(1), detail:z.string().max(1000).optional(), at:z.number().int().positive() });
export const inboundMessageSchema = z.discriminatedUnion('type',[captureSubmitSchema,captureVerdictSchema,captureIssueSchema]);
export type CaptureSubmitMessage=z.infer<typeof captureSubmitSchema>; export type CaptureVerdictMessage=z.infer<typeof captureVerdictSchema>; export type CaptureIssueMessage=z.infer<typeof captureIssueSchema>; export type InboundMessage=z.infer<typeof inboundMessageSchema>;
export function parseInboundMessage(raw: unknown): InboundMessage|null { const parsed=inboundMessageSchema.safeParse(raw); return parsed.success?parsed.data:null; }

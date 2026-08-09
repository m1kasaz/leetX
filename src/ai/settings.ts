import { z } from 'zod';

export const aiSettingsSchema = z.object({
  baseUrl: z.string().trim().min(1).transform((value, ctx) => {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      return url.toString();
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Base URL 必须是无凭据的 HTTP(S) URL' });
      return z.NEVER;
    }
  }),
  model: z.string().trim().min(1, '模型不能为空'),
  timeout: z.coerce.number().int().min(1000).max(300000),
});
export type AISettings = z.infer<typeof aiSettingsSchema>;
export interface AISettingsView { baseUrl: string; model: string; timeout: number; hasApiKey: boolean }
export const DEFAULT_AI_SETTINGS: AISettings = { baseUrl: '', model: '', timeout: 180000 };
export function endpointOrigin(baseUrl: string): string { return `${new URL(baseUrl).origin}/*`; }

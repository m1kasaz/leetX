import { z } from 'zod';
export const BRIDGE_CHANNEL='leetx-bridge-v1';
export const bridgeRequestSchema=z.object({source:z.literal('leetx-content'),channel:z.literal(BRIDGE_CHANNEL),nonce:z.string().min(8),requestId:z.string().min(8),action:z.literal('GET_EDITOR_SNAPSHOT')});
export const bridgeResponseSchema=z.object({source:z.literal('leetx-page'),channel:z.literal(BRIDGE_CHANNEL),nonce:z.string().min(8),requestId:z.string().min(8),ok:z.boolean(),payload:z.object({code:z.string(),language:z.string()}).optional(),error:z.string().optional()});
export type BridgeRequest=z.infer<typeof bridgeRequestSchema>; export type BridgeResponse=z.infer<typeof bridgeResponseSchema>;

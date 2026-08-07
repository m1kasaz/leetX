export interface IdempotencyInput { platform:string; problemKey:string; accountKey:string; submittedAt:number; language:string; codeHash:string }
export function buildIdempotencyKey(input:IdempotencyInput):string { return [input.platform,input.problemKey,input.accountKey,String(Math.floor(input.submittedAt/5000)),input.language,input.codeHash].join('|'); }

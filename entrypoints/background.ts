import { listCaptures, type CaptureEntry, type StorageLike } from '../src/db/captureLog';
import { createMessageHandler } from '../src/messaging/handlers';
import { aiSettingsSchema, DEFAULT_AI_SETTINGS, endpointOrigin, type AISettings } from '../src/ai/settings';
import { requestOpenAI } from '../src/ai/provider';
import { nodeAnalysisPrompt, recordAnalysisPrompt } from '../src/ai/prompts';
import { listAnalyses, saveAnalysis } from '../src/ai/storage';
import { AI_STREAM_PORT } from '../src/ai/streamProtocol';
import { handleStreamPort } from '../src/ai/streamServer';

type PrivilegedMessage =
  | {type:'leetx/get-ai-settings'}
  | {type:'leetx/save-ai-settings';settings:unknown;apiKey?:string}
  | {type:'leetx/test-ai-connection';settings:unknown;apiKey?:string}
  | {type:'leetx/analyze-node';current:CaptureEntry;previous?:CaptureEntry}
  | {type:'leetx/analyze-record';problemKey:string;submissions:CaptureEntry[]}
  | {type:'leetx/list-analyses';problemKey?:string};
const SETTINGS_KEY='leetx:aiSettings',KEY_KEY='leetx:aiApiKey';
export default defineBackground(()=>{
  const storage:StorageLike={get:key=>chrome.storage.local.get(key),set:items=>chrome.storage.local.set(items)};
  const captureHandler=createMessageHandler(storage);
  async function settings():Promise<AISettings>{const raw=(await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];return aiSettingsSchema.safeParse(raw).data??DEFAULT_AI_SETTINGS}
  async function key(){return String((await chrome.storage.session.get(KEY_KEY))[KEY_KEY]??'')}
  async function requirePermission(baseUrl:string){const origins=[endpointOrigin(baseUrl)];if(!await chrome.permissions.contains({origins}))throw new Error('请先授予该 AI 端点的访问权限')}
  async function privileged(msg:PrivilegedMessage){
    if(msg.type==='leetx/get-ai-settings'){const value=await settings();return{...value,hasApiKey:Boolean(await key())}}
    if(msg.type==='leetx/save-ai-settings'||msg.type==='leetx/test-ai-connection'){
      const parsed=aiSettingsSchema.parse(msg.settings);await requirePermission(parsed.baseUrl);const apiKey=msg.apiKey?.trim()||await key();if(!apiKey)throw new Error('API Key 不能为空');if(!/^[\x21-\x7E]+$/.test(apiKey))throw new Error('API Key 包含中文、空格或不可见字符，请重新复制纯英文 Key');
      if(msg.type==='leetx/save-ai-settings'){await chrome.storage.local.set({[SETTINGS_KEY]:parsed});if(msg.apiKey?.trim())await chrome.storage.session.set({[KEY_KEY]:msg.apiKey.trim()});return{ok:true}}
      await requestOpenAI(parsed,apiKey,'仅回复 JSON：{"ok":true}');return{ok:true};
    }
    if(msg.type==='leetx/list-analyses')return listAnalyses(storage,msg.problemKey);
    const configured=await settings(),apiKey=await key();if(!apiKey)throw new Error('请先配置 API Key');if(!/^[\x21-\x7E]+$/.test(apiKey))throw new Error('API Key 包含中文、空格或不可见字符，请重新配置');await requirePermission(configured.baseUrl);
    if(msg.type==='leetx/analyze-node'){
      const c=msg.current,p=msg.previous;const prompt=nodeAnalysisPrompt(c,p);const content=await requestOpenAI(configured,apiKey,prompt);const value={id:`node:${c.captureId}`,scope:'node' as const,problemKey:c.problemKey,captureId:c.captureId,createdAt:Date.now(),content};await saveAnalysis(storage,value);return value;
    }
    const final=msg.submissions.at(-1);if(!final)throw new Error('记录为空');const prompt=recordAnalysisPrompt(msg.problemKey,msg.submissions);const content=await requestOpenAI(configured,apiKey,prompt);const value={id:`record:${msg.problemKey}`,scope:'record' as const,problemKey:msg.problemKey,createdAt:Date.now(),content};await saveAnalysis(storage,value);return value;
  }
  chrome.runtime.onMessage.addListener((raw,sender,sendResponse)=>{void(async()=>{try{const type=(raw as {type?:string}|null)?.type;if(type==='leetx/list-captures')return await listCaptures(storage);if(type?.startsWith('leetx/')&&['leetx/get-ai-settings','leetx/save-ai-settings','leetx/test-ai-connection','leetx/analyze-node','leetx/analyze-record','leetx/list-analyses'].includes(type)){if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('/')))throw new Error('仅扩展页面可调用 AI');return await privileged(raw as PrivilegedMessage)}return await captureHandler(raw)}catch(error){return{ok:false,error:error instanceof Error?error.message:String(error)}}})().then(sendResponse);return true});
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== AI_STREAM_PORT) return;
    const url = port.sender?.url ?? '';
    if (port.sender?.id !== chrome.runtime.id || !url.startsWith(chrome.runtime.getURL('/'))) {
      port.disconnect();
      return;
    }
    handleStreamPort(port, { loadSettings: settings, loadApiKey: key, requirePermission, storage });
  });
});

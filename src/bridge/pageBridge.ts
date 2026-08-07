import { BRIDGE_CHANNEL,bridgeRequestSchema } from './protocol'; import { BRIDGE_SELECTORS } from './selectors';
interface MonacoModelLike{getValue():string;getLanguageId?():string} interface CodeMirror5Like{getValue():string;getOption?(key:string):unknown}
export function readMainWorldSnapshot():{code:string;language:string}|null{
 const monaco=(window as unknown as {monaco?:{editor?:{getModels?:()=>MonacoModelLike[]}}}).monaco;
 const model=(monaco?.editor?.getModels?.()??[]).find(m=>m.getValue().trim().length>0);
 if(model)return{code:model.getValue(),language:model.getLanguageId?.()??''};
 const host=document.querySelector(BRIDGE_SELECTORS.codeMirrorHost) as (Element&{CodeMirror?:CodeMirror5Like})|null; const cm=host?.CodeMirror;
 if(cm){const code=cm.getValue();const mode=cm.getOption?.('mode');if(code.trim())return{code,language:typeof mode==='string'?mode:''};} return null;
}
export function installPageBridge(nonce:string):void{ window.addEventListener('message',(event:MessageEvent)=>{const parsed=bridgeRequestSchema.safeParse(event.data);if(!parsed.success||parsed.data.nonce!==nonce)return;let result:Record<string,unknown>;try{const snapshot=readMainWorldSnapshot();result=snapshot?{ok:true,payload:snapshot}:{ok:false,error:'no-editor-found'};}catch(error){result={ok:false,error:String(error)}} window.postMessage({source:'leetx-page',channel:BRIDGE_CHANNEL,nonce,requestId:parsed.data.requestId,...result},location.origin);});}

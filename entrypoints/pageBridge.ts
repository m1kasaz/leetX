import{installPageBridge}from'../src/bridge/pageBridge';
export default defineUnlistedScript(()=>{const nonce=document.documentElement.dataset.leetxNonce??'';if(nonce)installPageBridge(nonce)});

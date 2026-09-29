// Simulator injects the same interface before this file; no official SDK is loaded there.
window.rxSdk = window.rxSdk || {
  async init(){
    if(!LIFF_CONFIG.liffId||!LIFF_CONFIG.gasUrl)throw Error('薬局の画面を準備中です。トークからお送りください。');
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://static.line-scdn.net/liff/edge/2/sdk.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});
    await liff.init({liffId:LIFF_CONFIG.liffId});
    if(!liff.isLoggedIn()){liff.login();throw Error('LINEでログインしています。');}
  },
  token(){return liff.getIDToken();},close(){liff.closeWindow();},
  async request(body){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
    try{return await (await fetch(LIFF_CONFIG.gasUrl,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body),signal:controller.signal,redirect:'follow',credentials:'omit'})).json();}
    finally{clearTimeout(timer);}
  }
};

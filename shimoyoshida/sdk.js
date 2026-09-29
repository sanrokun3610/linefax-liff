// Simulator injects the same interface before this file; no official SDK is loaded there.
window.rxSdk = window.rxSdk || {
  async init(){
    if(!LIFF_CONFIG.liffId||!LIFF_CONFIG.gasUrl)throw Error('薬局の画面を準備中です。トークからお送りください。');
    if(!window.liff)throw Error('読み込みできませんでした。通信を確認して開き直してください。');
    await liff.init({liffId:LIFF_CONFIG.liffId});
    if(!liff.isLoggedIn()){liff.login();throw Error('LINEでログインしています。');}
  },
  token(){return liff.getIDToken();},close(){liff.closeWindow();},
  async request(body){
    // AbortControllerのないWebViewでも待ち時間を制限する。再送はapp側の照会判定に任せる。
    const controller=typeof AbortController==='function'?new AbortController():null;
    let timer;
    const timeout=new Promise((resolve,reject)=>{timer=setTimeout(()=>{if(controller)controller.abort();reject(Error('通信を確認できません。少し待ってからお試しください。'));},120000);});
    const options={method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body),redirect:'follow',credentials:'omit'};
    if(controller)options.signal=controller.signal;
    try{return await Promise.race([fetch(LIFF_CONFIG.gasUrl,options).then(response=>response.json()),timeout]);}
    finally{clearTimeout(timer);}
  }
};

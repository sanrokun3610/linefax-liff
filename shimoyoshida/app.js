'use strict';
// 実際に使うDOM APIだけを補う（文字列のpadStart/startsWithは未使用）。
(function () {
 if(typeof Element==='undefined')return;
 if(!Element.prototype.append)Element.prototype.append=function(){for(var i=0;i<arguments.length;i++){var item=arguments[i];this.appendChild(typeof item==='string'?document.createTextNode(item):item);}};
 if(!Element.prototype.replaceChildren)Element.prototype.replaceChildren=function(){while(this.firstChild)this.removeChild(this.firstChild);this.append.apply(this,arguments);};
})();
function sendingId(){
 if(crypto.randomUUID)return crypto.randomUUID();
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 return Array.from(bytes,(b,i)=>([4,6,8,10].includes(i)?'-':'')+('0'+b.toString(16)).slice(-2)).join('');
}
const $=id=>document.getElementById(id),KEY='fujikawa-rx-choice',PENDING='fujikawa-rx-pending';
let draft,photos=[],choice={},step='photo',busy=false,replaceIndex=null,pending=null,deleteIndex=null,retry=false,terminal='',resumeInvalid=false,loading=true,progressText='',adding=false,closeRequested=false,photoLoading=false;
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(_){return null;}};
const save=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v));}catch(_){}};
function persist(){save(KEY,{savedAt:Date.now(),mode:choice.mode,date:choice.date,time:choice.time,handoverPlace:choice.handoverPlace});}
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
function button(text,fn,primary=false,selected=false,label='読み込み中…',touch=true){const b=node('button',(selected?'✓ ':'')+text,primary?'primary':selected?'selected':'');b.disabled=busy;b.onclick=()=>work(fn,label,touch);return b;}
function notice(text){$('notice').textContent=text;}
const errors={ALREADY_SENT_OTHER:'写真は自動で薬局へ送信済みです。日時は薬局へお電話ください',OCR_UNAVAILABLE:'いま写真を確認できません。少し待ってからもう一度送ってください',DAILY_LIMIT:'本日はこれ以上送れません。薬局へお電話ください',TALK_PHOTO_LIMIT:'写真が多すぎます。トークで「処方せん送信」からやり直してください',NOT_PRESCRIPTION:'処方せんが読み取れませんでした。もう一度、書類全体がはっきり写るように撮ってください。',SLOT:'選べる日時が変わりました。日付を選び直してください。'};
async function api(action,body={}){const r=await rxSdk.request(Object.assign({action,idToken:rxSdk.token()},body));if(!r.ok){const e=Error(errors[r.error.code]||r.error.message);e.code=r.error.code;throw e;}return r.data;}
async function work(fn,label='読み込み中…',touch=true){if(busy)return;busy=true;progressText=label;render();try{notice('');await fn();if(touch&&draft&&!pending&&!['sent','blocked'].includes(step))await api('saveChoice',{draftId:draft.draftId});}catch(e){if(e.code==='ALREADY_SENT_OTHER'){terminal=e.message;step='blocked';}if(e.code==='SLOT'){delete choice.date;delete choice.time;step='dates';persist();try{draft=await api('getDraft',{draftId:draft.draftId});}catch(refreshError){if(refreshError.code==='ALREADY_SENT_OTHER'){terminal=refreshError.message;step='blocked';}}}notice(e.message||'通信を確認できません。少し待ってからお試しください。');}finally{busy=false;progressText='';render();}}
function dateLabel(iso){const d=new Date(iso+'T00:00:00+09:00');return (iso===draft.today?'今日 ':'')+Number(iso.slice(5,7))+'月'+Number(iso.slice(8,10))+'日（'+['日','月','火','水','木','金','土'][new Date(d.getTime()+9*3600000).getUTCDay()]+'）';}
function noteDate(iso){const diff=(new Date(iso+'T00:00:00+09:00')-new Date(draft.today+'T00:00:00+09:00'))/86400000;return diff===0?'今日':diff===1?'明日':dateLabel(iso);}
function timeLabel(t){if(t==='ANY')return '時間は決めずに行く';const [h,m]=t.split(':').map(Number);return h===12&&m===0?'昼12時':(h<12?'午前':'午後')+(h%12||12)+'時'+(m===30?'半':m?m+'分':'');}
const count=()=>photos.length+((draft && draft.talkPhotos ? draft.talkPhotos.count : 0)||0);
const modeLabel=()=>({in_store:'薬局で受け取り',drive_thru:'ドライブスルー',online:'オンライン服薬指導'}[choice.mode]||'');
const handoverLabel=()=>{const place=draft.handoverPlaces.find(h=>h.value===choice.handoverPlace);return place?place.label:'';};
async function go(s){
 if(s==='dates'){draft=await api('getDraft',{draftId:draft.draftId});await validateChoice();}
 if(s==='times'){choice.slots=(await api('getSlots',{draftId:draft.draftId,mode:choice.mode,date:choice.date})).slots;}
 step=s;persist();
}
async function validateChoice(){
 const m=draft.methods.find(m=>m.value===choice.mode);if(!m){choice={};return;}
 if(choice.date){let valid=m.dates.includes(choice.date);if(valid){choice.slots=(await api('getSlots',{draftId:draft.draftId,mode:choice.mode,date:choice.date})).slots;valid=choice.time==='ANY'?choice.slots.length>0:!choice.time||choice.slots.includes(choice.time);}
 if(!valid){delete choice.date;delete choice.time;delete choice.slots;resumeInvalid=true;persist();}}
}
function row(parent,text,target){const r=node('div',null,'done-row');r.append(node('span','✓ '+text),button('変更',()=>go(target)));parent.append(r);}
function summary(parent){
 if(step==='confirm'){
   row(parent,'写真'+count()+'枚・'+modeLabel(),'method');
   if(choice.mode==='online')row(parent,'原本：'+handoverLabel(),'handover');
   row(parent,dateLabel(choice.date)+'・'+timeLabel(choice.time),'dates');
 }else{
   row(parent,'写真'+count()+'枚','photo');
   if(choice.mode&&step!=='method')row(parent,modeLabel(),'method');
   if(choice.mode==='online'&&choice.handoverPlace&&!['method','handover'].includes(step))row(parent,'原本：'+handoverLabel(),'handover');
   if(choice.date&&step==='times')row(parent,dateLabel(choice.date),'dates');
 }
}
function showPhotos(parent,edit){const wrap=node('div',null,edit?'photos edit':'photos');
 for(let i=0;i<draft.talkPhotos.count;i++){wrap.append(node('div',edit?(i+1)+'枚目：トークの写真（引き継ぎ済み）':'トーク '+(i+1)+'枚目','talk-photo'));}
 photos.forEach((p,i)=>{const box=node('div',null,'photo'),img=node('img');img.src=p.url;img.alt=(draft.talkPhotos.count+i+1)+'枚目の処方せん';box.append(img);if(edit){const actions=node('div',null,'actions');if(deleteIndex===i){box.append(node('p','この写真を消しますか？'));actions.append(button('はい、消す',()=>{photos.splice(i,1);deleteIndex=null;}),button('やめる',()=>{deleteIndex=null;}));}else actions.append(button('撮り直す',()=>pick(true,i),false,false,'写真を選んでいます…',false),button('消す',()=>{deleteIndex=i;}));box.append(actions);}wrap.append(box);});if(!edit)row(wrap,'写真','photo');parent.append(wrap);}
async function pick(camera,index=null){replaceIndex=index;step='photo';if(rxSdk.photo){const p=await rxSdk.photo();if(p){progressText='追加中…';render();await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));await addPhoto(p,index);await api('saveChoice',{draftId:draft.draftId});}return;}$(camera?'camera':'album').click();}
async function compress(file){
  const url=URL.createObjectURL(file);
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('写真を開けませんでした。もう一度選んでください。'));img.src=url;});const scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',0.85);return {url:data,base64:data.split(',')[1]};}finally{URL.revokeObjectURL(url);}
}
async function addPhoto(photo,index){const next=photos.slice();if(index===null)next.push(photo);else next[index]=photo;if(next.length+draft.talkPhotos.count>5||next.reduce((n,p)=>n+Math.floor(p.base64.length*3/4),0)>5*1024*1024)throw Error('写真は5枚・合計5MBまでです。枚数を減らしてください。');photos=next;adding=false;await go('photo');}
async function chooseMode(mode){choice.mode=mode;if(mode!=='online')delete choice.handoverPlace;await validateChoice();await go(mode==='online'?'handover':'dates');}
function clearPending(){pending=null;save(PENDING,null);}
function result(r){
 if(r.status==='sent'){closeRequested=false;if(r.source==='other'){terminal=errors.ALREADY_SENT_OTHER;step='blocked';return;}if(r.choice)Object.assign(choice,r.choice);step='sent';clearPending();photos=[];save(KEY,null);}
 else if(r.status==='failed'){clearPending();step=count()?'confirm':'photo';retry=true;notice('送信できませんでした。写真は消えていません。もう一度お試しください。');}
 else if(r.status==='unknown'){step='blocked';terminal='送れたか確認できませんでした。お手数ですが薬局へお電話ください';}
 else {pending=pending||{sendingId:r.sendingId};save(PENDING,pending);step='confirm';notice('送信結果を確認中です。');}
}
async function check(){
 const until=Date.now()+120000;
 while(pending){const r=await api('status',{sendingId:pending.sendingId});if(r.status==='not_found'){clearPending();retry=true;notice('送信できませんでした。写真は消えていません。もう一度お試しください。');return;}result(r);if(r.status!=='processing')return;if(Date.now()>=until){step='blocked';terminal='送れたか確認できませんでした。お手数ですが薬局へお電話ください';return;}await new Promise(resolve=>setTimeout(resolve,2000));}
}
async function submit(){
 if(pending){await check();return;}
 pending={sendingId:sendingId()};save(PENDING,pending);render();
 try{result(await api('submit',Object.assign({},choice,{pickTime:choice.time,draftId:draft.draftId,sendingId:pending.sendingId,photos:photos.map(p=>p.base64)})));if(pending&&step!=='blocked')await check();}
 catch(e){if(e.code){clearPending();retry=true;if(e.code==='NOT_PRESCRIPTION'||e.code==='PHOTO_LIMIT')step='photo';if(['DAILY_LIMIT','TALK_PHOTO_LIMIT'].includes(e.code)){terminal=e.message;step='blocked';}throw e;}
 try{await check();}catch(statusError){step='blocked';terminal=statusError.code==='ALREADY_SENT_OTHER'?errors.ALREADY_SENT_OTHER:'送れたか確認できませんでした。お手数ですが薬局へお電話ください';}}
}
function nextText(){if(choice.mode==='online')return {mail:'あとで処方せんの原本を、郵送してください。',dropbox:'処方せんの原本を、薬局のポストに入れてください。',visit:'次に来たときに、処方せんの原本を渡してください。'}[choice.handoverPlace];return (choice.time==='ANY'?timeLabel(choice.earliestTime||(choice.slots && choice.slots[0]))+'以降に、':'受け取り日時になったら、')+(choice.mode==='drive_thru'?'車でドライブスルーへお越しください。':'薬局へお越しください。');}
function requestClose(){
 if((count() || photoLoading) && step!=='sent' && terminal!==errors.ALREADY_SENT_OTHER){closeRequested=true;render();}
 else rxSdk.close();
}
function render(){
 $('font').disabled=busy;
 $('pharmacy-heading').textContent=(draft && draft.pharmacyName)||'処方せんを送る';
 const main=$('main');main.replaceChildren();
 if(closeRequested){
   const panel=node('section',null,'panel close-confirm');panel.setAttribute('role','alertdialog');panel.setAttribute('aria-labelledby','close-question');
   const title=node('h1','まだ送っていません。閉じますか？');title.id='close-question';
   const stay=node('button','このまま続ける','primary'),leave=node('button','閉じる');
   stay.onclick=()=>{closeRequested=false;render();};leave.onclick=()=>rxSdk.close();panel.append(title,stay,leave);main.append(panel);return;
 }
 if(busy){const status=node('div',progressText,'progress');status.setAttribute('role','status');const spinner=node('span',null,'spinner');spinner.setAttribute('aria-hidden','true');status.append(spinner);main.append(status);}
 if(!draft){if(loading){const panel=node('section',null,'panel');panel.append(node('h1','処方せんの写真を送ってね'),button('カメラで撮る',()=>{}),button('アルバムから選ぶ',()=>{}));main.append(panel);}else main.append(node('p','画面を開けませんでした。通信を確認して開き直してください。'));return;}
 if(!['photo','sent','blocked'].includes(step))summary(main);
 const p=node('section',null,'panel '+step);main.append(p);
 if(step==='sent'){p.append(node('div','✓','check'),node('h1',(draft.pharmacyName||'薬局')+'へ送りました'),node('p',nextText()),node('p','同じ内容がトークにも届きます。'),button('閉じる',()=>rxSdk.close(),true));return;}
 if(step==='blocked'){notice('');p.append(node('h1',terminal),button('閉じる',()=>rxSdk.close(),true));return;}
 if(step==='photo'){
 p.append(node('h1','処方せんの写真を送ってね'));if(!count())p.append(node('p','処方せん全体がはっきり写るように撮ってね。'));p.append(node('p','写真 '+count()+'枚'));showPhotos(p,true);
 if(!count()||adding){p.append(button('カメラで撮る',()=>pick(true),false,false,'写真を選んでいます…',false),button('アルバムから選ぶ',()=>pick(false),false,false,'写真を選んでいます…',false),node('p','メニューが出たら「写真ライブラリ」または「フォト」を選んでね。','album-help'));}
 else p.append(button('もう1枚追加',()=>{adding=true;},false,false,'読み込み中…',false));
 if(count())p.append(button('次へ',()=>go(choice.mode?(choice.date&&choice.time?'confirm':choice.mode==='online'&&!choice.handoverPlace?'handover':'dates'):'method'),true));
 }
 if(step==='method'){p.append(node('h1','受け取り方法をえらんでね'));for(const [value,label,help] of [['in_store','薬局で受け取り','店頭でお渡しします'],['drive_thru','ドライブスルー','車に乗ったまま受け取れます'],['online','オンライン服薬指導','画面で説明を受けます']]){const b=button(label,()=>chooseMode(value),false,choice.mode===value);b.append(node('small',help));p.append(b);}}
 if(step==='handover'){p.append(node('h1','処方せんの原本は、どうしますか？'));draft.handoverPlaces.forEach(h=>p.append(button(h.label,async()=>{choice.handoverPlace=h.value;await go('dates');},false,choice.handoverPlace===h.value)));}
 if(step==='dates'){p.append(node('h1','受け取りたい日をえらんでね'),node('p','お休みの日は出ません。'));const method=draft.methods.find(m=>m.value===choice.mode),dates=method?method.dates:[];dates.forEach(d=>p.append(button(dateLabel(d),async()=>{if(choice.date!==d)delete choice.time;choice.date=d;await go('times');},false,choice.date===d)));if(!dates.length)p.append(node('p','いま選べる日がありません。お手数ですが薬局へお電話ください。'));}
 if(step==='times'){
 p.append(node('h1','受け取りたい時間をえらんでね'),node('p',dateLabel(choice.date)+'・選べる時刻だけ表示しています。'));
 const slots=choice.slots||[];if(slots.length){const b=button('時間は決めずに行く',async()=>{choice.time='ANY';await go('confirm');},false,choice.time==='ANY');b.append(node('small','お薬は '+noteDate(choice.date)+'の'+timeLabel(slots[0])+'から お渡しできます'));p.append(b);}
 for(const [label,am] of [['午前',true],['午後',false]]){const group=slots.filter(t=>(Number(t.split(':')[0])<12)===am);if(!group.length)continue;p.append(node('h2',label));const grid=node('div',null,'time-grid');group.forEach(t=>grid.append(button(timeLabel(t),async()=>{choice.time=t;await go('confirm');},false,choice.time===t)));p.append(grid);}
 if(!slots.length)p.append(node('p','選べる時刻がありません。上の「変更」から日付を選び直してください。'));
 }
 if(step==='confirm'){
 p.append(node('h1','送る内容を確認してください'));showPhotos(p,false);
 if(choice.time==='ANY')p.append(node('p',timeLabel(choice.slots[0])+'から お渡しできます'));
 p.append(button(pending?'送信結果を確認する':retry?'もう一度送る':'この内容で薬局へ送る',submit,true,false,'送信中…しばらくお待ちください'));
 }
 if(['photo','confirm'].includes(step))p.append(node('p','写真は薬局へ送るためだけに使い、この画面には残りません','privacy'));
}
for(const id of ['camera','album'])$(id).onchange=()=>work(async()=>{try{const file=$(id).files[0];if(file){photoLoading=true;await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));await addPhoto(await compress(file),replaceIndex);}else step='photo';}finally{photoLoading=false;$(id).value='';}},'追加中…');
$('header-close').onclick=requestClose;
$('font').onclick=()=>{const on=document.documentElement.classList.toggle('large');$('font').textContent=on?'文字を標準に戻す':'文字を大きく';save('fujikawa-rx-large',on);};
const ready=work(async()=>{try{await rxSdk.init();if(read('fujikawa-rx-large')){$('font').onclick();}choice=read(KEY)||{};if(Date.now()-(choice.savedAt||0)>86400000){choice={};save(KEY,null);}pending=read(PENDING);draft=await api('getDraft');if(pending){await check();}else if(draft.receipt&&draft.receipt.status!=='failed'){result(draft.receipt);if(pending&&step!=='blocked')await check();}else{await validateChoice();step=draft.talkPhotos.count?(resumeInvalid?'dates':'method'):'photo';if(choice.mode)notice('写真だけもう一度お願いします');}}finally{loading=false;}},'読み込み中…',false);
addEventListener('pagehide',()=>{photos=[];$('main').replaceChildren();});
addEventListener('pageshow',e=>{if(e.persisted&&!pending&&step!=='sent')work(async()=>{draft=await api('getDraft',{draftId:draft.draftId});await validateChoice();step=count()?(resumeInvalid?'dates':'method'):'photo';});else if(e.persisted)render();});

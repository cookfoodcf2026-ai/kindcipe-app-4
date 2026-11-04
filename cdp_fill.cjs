const http=require('http');
const fs=require('fs');
if (typeof WebSocket === 'undefined') { global.WebSocket = require('ws'); }
function get(p,m='GET'){return new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port:9222,path:p,method:m},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(d))});r.on('error',rej);r.end()})}
const IDX=Number(process.env.IDX||0), VAL=process.env.VAL||'', OUT=process.env.OUT||'/tmp/filled.png';
(async()=>{
  const list=JSON.parse(await get('/json/list'));
  const cands=list.filter(t=>t.type==='page'&&/app\.kindcipe\.com/.test(t.url));
  const page=cands[cands.length-1];
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}))});
  ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result)}});
  await new Promise(r=>ws.addEventListener('open',r));
  await send('Runtime.enable');
  const r=await send('Runtime.evaluate',{expression:`(()=>{
    const ins=Array.from(document.querySelectorAll('input'));
    const el=ins[${IDX}];
    if(!el) return 'no input '+${IDX}+' (count='+ins.length+')';
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(el, ${JSON.stringify(VAL)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return 'ok:'+el.value;
  })()`,returnByValue:true});
  console.log('FILL:',r.result.value);
  const txt=await send('Runtime.evaluate',{expression:'document.body.innerText.slice(0,200)',returnByValue:true});
  console.log('TEXT:',String(txt.result.value).replace(/\n+/g,' | '));
  const shot=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(OUT,Buffer.from(shot.data,'base64'));
  ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

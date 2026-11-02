const http = require('http');
const fs = require('fs');
function get(path, method='GET'){return new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port:9222,path,method},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(d))});r.on('error',rej);r.end()})}
const TARGET = process.env.TARGET_TEXT || '使用電郵繼續';
(async()=>{
  const list = JSON.parse(await get('/json/list'));
  const page = list.find(t=>t.type==='page' && /app\.kindcipe\.com/.test(t.url));
  if(!page){ console.error('no app page'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pend=new Map();
  const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}))});
  ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result)}});
  await new Promise(r=>ws.addEventListener('open',r));
  await send('Runtime.enable');
  const r = await send('Runtime.evaluate',{expression:`(()=>{
    const t=${JSON.stringify(TARGET)};
    const els=Array.from(document.querySelectorAll('div,button,a,span'));
    const hit=els.find(e=>(e.innerText||'').trim()===t) || els.find(e=>(e.innerText||'').trim().includes(t));
    if(!hit) return 'not found';
    let n=hit; for(let i=0;i<4&&n;i++){ if(n.getAttribute&&(n.getAttribute('role')==='button'||n.tagName==='BUTTON')) break; n=n.parentElement; }
    (n||hit).click(); return 'clicked';
  })()`, returnByValue:true});
  console.log('click:', r.result.value);
  await new Promise(r=>setTimeout(r,3500));
  const url = await send('Runtime.evaluate',{expression:'location.href',returnByValue:true});
  const txt = await send('Runtime.evaluate',{expression:'document.body.innerText.slice(0,400)',returnByValue:true});
  console.log('URL:', url.result.value);
  console.log('TEXT:', String(txt.result.value).replace(/\n+/g,' | '));
  const shot = await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('/tmp/cdp_step.png', Buffer.from(shot.data,'base64'));
  ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

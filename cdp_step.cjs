const http=require('http'),fs=require('fs');
function get(p,m='GET'){return new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port:9222,path:p,method:m},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(d))});r.on('error',rej);r.end()})}
const TEXT=process.env.TXT, RE=process.env.RE, OUT=process.env.OUT||'/tmp/s.png';
(async()=>{
  const list=JSON.parse(await get('/json/list'));
  const page=list.find(t=>t.type==='page'&&/app\.kindcipe\.com/.test(t.url));
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}))});
  ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result)}});
  await new Promise(r=>ws.addEventListener('open',r));
  await send('Page.enable'); await send('Runtime.enable');
  const ev=async(e)=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r.result.value};
  if(TEXT||RE){
    await ev(`(()=>{const t=${JSON.stringify(TEXT||'')},re=${RE?`new RegExp(${JSON.stringify(RE)})`:'null'};const els=Array.from(document.querySelectorAll('div,span,button,a'));const h=els.find(e=>{const s=(e.innerText||'').trim();return re?re.test(s)&&s.length<40:s===t});if(!h)return 'nf';h.scrollIntoView({block:'center',inline:'center'});return 'ok'})()`);
    await new Promise(r=>setTimeout(r,800));
    const b=JSON.parse(await ev(`(()=>{const t=${JSON.stringify(TEXT||'')},re=${RE?`new RegExp(${JSON.stringify(RE)})`:'null'};const els=Array.from(document.querySelectorAll('div,span,button,a'));const h=els.find(e=>{const s=(e.innerText||'').trim();return re?re.test(s)&&s.length<40:s===t});if(!h)return JSON.stringify({e:1});const r=h.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,v:r.y>0&&r.y<innerHeight})})()`));
    console.log('BOX', JSON.stringify(b));
    if(!b.e&&b.v){for(const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type,x:b.x,y:b.y,button:'left',clickCount:1});}
    await new Promise(r=>setTimeout(r,Number(process.env.WAIT||5000)));
  }
  console.log('TEXT:', (await ev('document.body.innerText')).replace(/\n+/g,' | ').slice(0,500));
  const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(OUT,Buffer.from(s.data,'base64'));
  ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

const http=require('http');
if (typeof WebSocket === 'undefined') { global.WebSocket = require('ws'); };
function get(p,m='GET'){return new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port:9222,path:p,method:m},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(d))});r.on('error',rej);r.end()})}
const EXPR = process.env.EXPR || '1';
(async()=>{
  const list=JSON.parse(await get('/json/list'));
  const page=list.find(t=>t.type==='page'&&/app\.kindcipe\.com/.test(t.url));
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}))});
  ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result)}});
  await new Promise(r=>ws.addEventListener('open',r));
  await send('Runtime.enable');
  const r=await send('Runtime.evaluate',{expression:EXPR,awaitPromise:true,returnByValue:true});
  console.log(JSON.stringify(r.result.value ?? r.result.description ?? r.result, null, 1).slice(0,1200));
  ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

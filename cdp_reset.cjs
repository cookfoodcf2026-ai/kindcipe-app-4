const http=require('http'),fs=require('fs');
function get(p,m='GET'){return new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port:9222,path:p,method:m},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(d))});r.on('error',rej);r.end()})}
(async()=>{
  const list=JSON.parse(await get('/json/list'));
  const page=list.find(t=>t.type==='page'&&/app\.kindcipe\.com/.test(t.url));
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}))});
  ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result)}});
  await new Promise(r=>ws.addEventListener('open',r));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const ev=async(e)=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r.result.value};
  console.log('SW unregister:', await ev(`(async()=>{const rs=await navigator.serviceWorker.getRegistrations();for(const r of rs)await r.unregister();const ks=await caches.keys();for(const k of ks)await caches.delete(k);return 'unreg='+rs.length+' caches='+ks.length})()`));
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Page.navigate',{url:'https://app.kindcipe.com/onboarding'});
  await new Promise(r=>setTimeout(r,9000));
  console.log('URL', await ev('location.href'));
  console.log('TEXT', (await ev('document.body.innerText')).replace(/\n+/g,' | ').slice(0,300));
  const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(process.env.OUT||'/tmp/g.png',Buffer.from(s.data,'base64'));
  ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

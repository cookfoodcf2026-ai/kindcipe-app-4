const http = require('http');
function get(path, method = 'GET') {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: 9222, path, method }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    });
    req.on('error', rej); req.end();
  });
}
async function main() {
  // 開新 tab 去 app
  const created = JSON.parse(await get('/json/new?https://app.kindcipe.com/', 'PUT'));
  const ws = new WebSocket(created.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 8000));
  const url = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  const txt = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,300)', returnByValue: true });
  const ls = await send('Runtime.evaluate', { expression: 'JSON.stringify(Object.keys(localStorage))', returnByValue: true });
  console.log('URL:', url.result.value);
  console.log('TEXT:', String(txt.result.value).replace(/\n+/g, ' | '));
  console.log('LS:', ls.result.value);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('/tmp/cdp_shot1.png', Buffer.from(shot.data, 'base64'));
  console.log('shot saved');
  ws.close();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });

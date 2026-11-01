// Captures real-time screenshots of a page in headless Chrome through the DevTools protocol, to check animations:
// the --screenshot option of headless Chrome runs on virtual time, which freezes CSS transitions and animation frames.
//
// usage: node scripts/capture-frames.mjs <url> <outPrefix> <width>x<height> <ms,ms,...> [options]
//   --before=<selector>     click this element once the page has loaded (for example a results tab)
//   --scroll=<selector>     scroll this element to the top of the viewport before the first frame
//   --click=<selector>@<ms> click this element at the given time
// Writes <outPrefix>-<ms>.png for each time, counted from the scroll. Needs Node 22 or later (global WebSocket).
// CHROME overrides the browser path. Example, with dist/ served on port 8765:
//   node scripts/capture-frames.mjs "http://localhost:8765/index.html#resultats" /tmp/bilan 1280x900 600,3000 --scroll=.orbit-panel
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [url, out, size, times, ...options] = process.argv.slice(2);
if (!url || !out || !/^\d+x\d+$/.test(size ?? '') || !times) {
  console.error('usage: node scripts/capture-frames.mjs <url> <outPrefix> <width>x<height> <ms,ms,...> [--before=sel] [--scroll=sel] [--click=sel@ms]');
  process.exit(2);
}
const option = name => options.find(o => o.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = size.split('x').map(Number);
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-frames-'));
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], {stdio: 'ignore'});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    ready = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.ok, () => false);
    if (!ready) await pause(200);
  }
  if (!ready) throw new Error('Chrome did not open its debugging port');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method: 'PUT'})).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, {once: true}));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  });
  const send = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); socket.send(JSON.stringify({id: n, method, params})); });
  const evaluate = expression => send('Runtime.evaluate', {expression});
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.dispatchEvent(new MouseEvent('click',{bubbles:true}))`);

  await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 600});
  await send('Page.enable');
  await send('Page.navigate', {url});
  await pause(900);
  if (option('before')) { await click(option('before')); await pause(400); }
  if (option('scroll')) await evaluate(`document.querySelector(${JSON.stringify(option('scroll'))})?.scrollIntoView({block:'start'})`);
  const [clickSelector, clickAt] = (option('click') ?? '').split('@');
  let clicked = !clickSelector;
  const start = Date.now();
  for (const time of times.split(',').map(Number)) {
    while (Date.now() - start < time) {
      if (!clicked && Date.now() - start >= Number(clickAt)) { await click(clickSelector); clicked = true; }
      await pause(20);
    }
    const shot = await send('Page.captureScreenshot', {format: 'png'});
    fs.writeFileSync(`${out}-${time}.png`, Buffer.from(shot.result.data, 'base64'));
    console.log(`${out}-${time}.png`);
  }
  socket.close();
} finally {
  // Chrome keeps writing its profile while it shuts down: wait for it to exit before removing the profile.
  const exited = new Promise(resolve => browser.once('exit', resolve));
  browser.kill();
  await Promise.race([exited, pause(5000)]);
  fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
}

// A plain test page for the live duel: open http://<PC address>:2567/duel in two or three tabs.
// First tab = attacker, second = defender, the rest watch. It signs up a throw-away account per tab (test only).
// Also serves the pictures (/items/<key>.webp) and the Colyseus browser SDK (/sdk.js) from this machine.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ITEMS_DIR = resolve(__dirname, '../../../../mobile/assets/items');
const SDK_FILE = resolve(__dirname, '../../../node_modules/@colyseus/sdk/dist/colyseus.js');

const PAGE = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>הזירה – דו־קרב חי</title>
<style>
:root{--bg:#0e1730;--card:#1b2748;--ink:#f4f6ff;--mute:#9aa7d0;--gold:#ffc247;--green:#3ecf7a;--red:#ff5d5d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,Heebo,Arial,sans-serif;padding:12px 16px 24px;max-width:520px;margin:auto}
h1{font-size:19px;margin:4px 0}.mute{color:var(--mute);font-size:14px}
#clocks{display:flex;gap:8px;margin:10px 0}.clock{flex:1;background:var(--card);border-radius:12px;padding:8px;text-align:center;border:3px solid transparent}
.clock.on{border-color:var(--gold)}.clock b{font-size:28px;display:block}.clock.me b{color:var(--green)}
#pic{height:260px;background:var(--card);border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden}
#pic img{max-width:100%;max-height:100%;object-fit:contain}
#row{display:flex;gap:8px;margin-top:10px}input{flex:1;font:inherit;font-size:18px;padding:12px;border-radius:12px;border:0;background:#fff;color:#111}
button{font:inherit;font-weight:700;background:var(--gold);color:#1a1a1a;border:0;border-radius:12px;padding:12px 18px}
#msg{margin-top:10px;min-height:24px;font-weight:700;text-align:center}
</style></head><body>
<h1>הזירה – דו־קרב חי</h1><div class="mute" id="status">מתחבר…</div>
<div id="clocks"><div class="clock" id="cA"><span class="mute" id="nA">תוקף</span><b id="tA">40</b></div>
<div class="clock" id="cD"><span class="mute" id="nD">מגן</span><b id="tD">40</b></div></div>
<div id="pic"><span class="mute">ממתין ליריב…</span></div>
<div id="row"><input id="ans" placeholder="התשובה" autocomplete="off" disabled><button id="skip" disabled>דלג −3</button></div>
<div id="msg"></div>
<script src="/sdk.js"></script>
<script>
const $=id=>document.getElementById(id);
let room,role=null,view=null,lastSent='';
const SEC=ms=>Math.ceil(ms/1000);
function render(){
  if(!view)return;
  const v=view,d=v.duel,me=role&&role!=='spectator'?role:null;
  $('nA').textContent='תוקף: '+(v.seats.attacker||'—');$('nD').textContent='מגן: '+(v.seats.defender||'—');
  $('cA').className='clock'+(d&&!v.winner&&d.active==='attacker'?' on':'')+(me==='attacker'?' me':'');
  $('cD').className='clock'+(d&&!v.winner&&d.active==='defender'?' on':'')+(me==='defender'?' me':'');
  if(d){
    const age=Date.now()-view.recvAt;
    const run=(s)=>d.winner||d.paused||d.active!==s?d.remainingMs[s]:Math.max(0,d.remainingMs[s]-age);
    $('tA').textContent=SEC(run('attacker'));$('tD').textContent=SEC(run('defender'));
    if(d.imageKey&&$('pic').dataset.key!==d.imageKey){const m=/^(.*)-\\d+$/.exec(d.imageKey);$('pic').dataset.key=d.imageKey;$('pic').innerHTML='<img src="/items/'+d.imageKey+'.webp">';}
  }
  const mine=!!me&&d&&!v.winner&&!d.paused&&d.active===me;
  $('ans').disabled=!mine;$('skip').disabled=!mine;
  $('status').textContent=(v.categoryName+' · '+v.wayName)+' · את/ה: '+(role==='attacker'?'תוקף':role==='defender'?'מגן':'צופה')+(v.spectators?' · צופים: '+v.spectators:'');
  if(v.winner){$('msg').textContent=(v.seats[v.winner]||'')+' ניצח/ה'+(v.endedBy==='forfeit'?' (היריב עזב)':' (נגמר הזמן)');$('ans').disabled=true;$('skip').disabled=true}
}
(async()=>{
  const email='t'+Date.now()+Math.floor(Math.random()*1e4)+'@example.com';
  const r=await (await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'secret1',name:'שחקן'+Math.floor(Math.random()*90+10)})})).json();
  const client=new Colyseus.Client(location.origin.replace('http','ws'));
  room=await client.joinOrCreate('duel',{token:r.token});
  room.onMessage('role',m=>{role=m.role;render()});
  room.onMessage('view',m=>{view=m;view.recvAt=Date.now();render()});
  room.onMessage('correct',()=>{$('msg').textContent='נכון! ✓';$('ans').value='';lastSent='';setTimeout(()=>{if($('msg').textContent==='נכון! ✓')$('msg').textContent=''},1200)});
  setInterval(render,200);
})();
$('ans').addEventListener('input',e=>{const t=e.target.value.trim();if(t&&t!==lastSent&&room){lastSent=t;room.send('answer',{text:t})}});
$('skip').addEventListener('click',()=>{if(room){room.send('skip');$('ans').value='';lastSent='';$('ans').focus()}});
</script></body></html>`;

export function mountDuelPage(app: any): void {
  app.get('/duel', (_req: any, res: any) => res.type('html').send(PAGE));
  app.get('/sdk.js', (_req: any, res: any) => res.sendFile(SDK_FILE));
  app.get('/items/:key.webp', (req: any, res: any) => {
    const match = /^([a-z0-9-]+)-(\d+)$/.exec(String(req.params.key));
    const file = match ? join(ITEMS_DIR, match[1], `${req.params.key}.webp`) : null;
    if (!file || !existsSync(file)) return res.status(404).end();
    res.sendFile(file);
  });
}

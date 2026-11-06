// Test page for rooms and the lobby: http://<PC address>:2567/rooms (open it in several tabs = several players).
// Each tab signs up a throw-away account (test only). The real in-app screens come later; this proves the server side.
export const ROOMS_PAGE = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>הזירה – חדרים</title>
<style>
:root{--bg:#0e1730;--card:#1b2748;--ink:#f4f6ff;--mute:#9aa7d0;--gold:#ffc247;--green:#3ecf7a;--red:#ff5d5d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,Heebo,Arial,sans-serif;padding:12px 16px 30px;max-width:560px;margin:auto}
h1{font-size:19px;margin:4px 0}h2{font-size:16px;margin:16px 0 6px}.mute{color:var(--mute);font-size:13px}
.card{background:var(--card);border-radius:12px;padding:10px 12px;margin:6px 0}
button{font:inherit;font-weight:700;background:var(--gold);color:#1a1a1a;border:0;border-radius:10px;padding:8px 14px}button:disabled{opacity:.4}
button.ghost{background:#ffffff1f;color:var(--ink)}input,select{font:inherit;padding:8px;border-radius:10px;border:0;background:#fff;color:#111}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.grow{flex:1}.cat{display:inline-block;margin:3px;padding:6px 10px;border-radius:10px;background:#ffffff1f;cursor:pointer;font-size:14px}
.cat.mine{background:var(--green);color:#111}.cat.taken{opacity:.35;pointer-events:none}.err{color:var(--red);font-weight:700;min-height:20px}
</style></head><body>
<h1>הזירה – חדרים</h1><div class="mute" id="me">מתחבר…</div><div class="err" id="err"></div>
<div id="rooms-screen">
 <h2>חדרים פתוחים</h2><div id="list"></div>
 <h2>הצטרפות עם קוד</h2><div class="row"><input id="code" maxlength="6" placeholder="קוד" style="width:110px;text-transform:uppercase"><button id="joinCode">הצטרף</button></div>
 <h2>חדר חדש</h2><div class="row"><input id="rname" class="grow" placeholder="שם החדר" maxlength="24"><select id="vis"><option value="public">ציבורי</option><option value="private">פרטי (קוד בלבד)</option></select><button id="create">צור חדר</button></div>
 <h2>מובילים</h2><div id="leaders" class="card"></div>
</div>
<div id="lobby-screen" hidden>
 <h2 id="lname"></h2><div class="mute" id="lmeta"></div><div id="members"></div>
 <h2>הקטגוריה שלי</h2><div id="cats"></div><div class="row" style="margin-top:8px"><button id="start">התחל משחק</button><button id="leave" class="ghost">יציאה</button></div>
 <div class="card mute" id="started" hidden></div>
</div>
<script src="/sdk.js"></script>
<script>
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
let token,client,room,categories=[],lobby=null,myId=null,wayOf={};
const err=m=>{$('err').textContent=m||'';if(m)setTimeout(()=>{if($('err').textContent===m)$('err').textContent=''},3500)};
const MSG={room_full:'החדר מלא (6 שחקנים)',in_game:'המשחק כבר התחיל – אפשר רק לצפות',category_taken:'הקטגוריה כבר נלקחה',need_more_players:'צריך לפחות שני שחקנים',need_categories:'לא כולם בחרו קטגוריה',not_host:'רק המארח מתחיל',already_in_room:'כבר בחדר הזה',no_such_room:'אין חדר עם הקוד הזה',not_signed_in:'לא מחובר'};
const api=async(p,o)=>(await fetch(p,o)).json();
async function boot(){
  const email='t'+Date.now()+Math.floor(Math.random()*1e4)+'@example.com',name='שחקן'+Math.floor(Math.random()*90+10);
  const r=await api('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'secret1',name})});
  token=r.token;$('me').textContent='מחובר כ־'+r.user.name;
  client=new Colyseus.Client(location.origin.replace('http','ws'));
  categories=(await api('/api/categories')).categories;
  refresh();setInterval(()=>{if(!room)refresh()},2500);
}
async function refresh(){
  const [{rooms},{leaders}]=await Promise.all([api('/api/rooms'),api('/api/leaders')]);
  $('list').innerHTML=rooms.length?rooms.map(r=>'<div class="card row"><div class="grow"><b>'+esc(r.name)+'</b><div class="mute">מארח: '+esc(r.host)+' · '+r.humans+'/'+r.maxHumans+' · '+(r.phase==='inGame'?'במשחק':'ממתין')+(r.watchers?' · צופים '+r.watchers:'')+'</div></div>'
    +(r.phase==='lobby'&&r.humans<r.maxHumans?'<button data-join="'+r.roomId+'">הצטרף</button>':'')+'<button class="ghost" data-watch="'+r.roomId+'">צפה</button></div>').join(''):'<div class="mute">אין חדרים פתוחים</div>';
  $('leaders').innerHTML=leaders.length?leaders.map((l,i)=>'<div>'+(i+1)+'. '+esc(l.name)+' – '+l.wins+' ניצחונות מתוך '+l.games+'</div>').join(''):'<span class="mute">עוד אין משחקים</span>';
}
async function enter(promise){
  try{room=await promise}catch(e){err(MSG[e.message]||e.message);return}
  $('rooms-screen').hidden=true;$('lobby-screen').hidden=false;myId=room.sessionId;
  room.onMessage('lobby',v=>{lobby=v;draw()});
  room.onMessage('error',m=>err(MSG[m.error]||m.error));
  room.onMessage('started',m=>{$('started').hidden=false;$('started').textContent='המשחק התחיל: '+m.players.length+' שחקנים על הלוח ('+m.players.filter(p=>p.isHuman).length+' בני אדם)'});
  room.onLeave(()=>{room=null;lobby=null;$('rooms-screen').hidden=false;$('lobby-screen').hidden=true;$('started').hidden=true;refresh()});
}
function draw(){
  if(!lobby)return;const me=lobby.members.find(m=>m.clientId===myId),cn=id=>(categories.find(c=>c.id===id)||{}).name||'—';
  $('lname').textContent=lobby.name;$('lmeta').textContent='קוד: '+lobby.code+' · '+(lobby.visibility==='private'?'פרטי':'ציבורי')+' · '+(lobby.phase==='inGame'?'במשחק':'ממתין לשחקנים')+(me?'':' · את/ה צופה');
  $('members').innerHTML=lobby.members.map(m=>'<div class="card">'+(m.isHost?'👑 ':'')+esc(m.name)+(m.clientId===myId?' (אני)':'')+' – '+esc(cn(m.categoryId))+'</div>').join('');
  $('cats').innerHTML=me&&lobby.phase==='lobby'?categories.map(c=>{const mine=me.categoryId===c.id,taken=!mine&&lobby.takenCategoryIds.includes(c.id);
    return '<span class="cat'+(mine?' mine':'')+(taken?' taken':'')+'" data-cat="'+c.id+'">'+c.icon+' '+esc(c.name)+'</span>'}).join(''):'';
  $('start').hidden=!(me&&lobby.hostClientId===myId&&lobby.phase==='lobby');$('start').disabled=!lobby.canStart;
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-join],[data-watch],[data-cat]');if(!t)return;
  if(t.dataset.join)enter(client.joinById(t.dataset.join,{token}));
  if(t.dataset.watch)enter(client.joinById(t.dataset.watch,{token,watch:true}));
  if(t.dataset.cat&&room)room.send('pickCategory',{categoryId:t.dataset.cat,wayId:'w1'});
});
$('joinCode').onclick=async()=>{const r=await api('/api/rooms/code/'+encodeURIComponent($('code').value.trim()));if(r.error)return err(MSG[r.error]);enter(client.joinById(r.roomId,{token,watch:r.phase==='inGame'}))};
$('create').onclick=async()=>{const name=$('rname').value.trim();if(!name)return err('צריך שם לחדר');const {code}=await api('/api/rooms/new-code',{headers:{Authorization:'Bearer '+token}});enter(client.create('game',{token,name,visibility:$('vis').value,code}))};
$('start').onclick=()=>room&&room.send('start');$('leave').onclick=()=>room&&room.leave();
boot();
</script></body></html>`;

// A visual page for watching the server play a bot-only game: open http://<PC address>:2567/watch (phone or PC).
// It runs its own game on the server (the same loop the rooms use) and the page polls a snapshot twice a second.
import { CATEGORY_BY_ID } from '../../mobile/src/content/categories';
import { createGame } from '../../mobile/src/game/engine';
import { createSeededRandom } from '../../mobile/src/game/rng';
import { isLoopDone, startLoop, stepGame } from './gameLoop';
import type { LoopEvent, LoopState } from './gameLoop';

const STEP_MS = Number(process.env.ARENA_WATCH_STEP_MS ?? 1400);

type Watch = { loop: LoopState; random: ReturnType<typeof createSeededRandom>; log: string[]; focus: { attackerId: string; defenderId: string } | null; timer: NodeJS.Timeout | null; seed: number };
let current: Watch | null = null;

function newGame(): Watch {
  if (current?.timer) clearInterval(current.timer);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const random = createSeededRandom(seed);
  const categoryId = Object.keys(CATEGORY_BY_ID).find((id) => CATEGORY_BY_ID[id].status === 'active')!;
  const state = createGame([{ id: 'host', name: 'מארח', categoryId }], random);
  state.players.host.isHuman = false;
  const watch: Watch = { loop: startLoop(state), random, log: ['המשחק מתחיל'], focus: null, timer: null, seed };
  watch.timer = setInterval(() => advance(watch), STEP_MS);
  current = watch;
  return watch;
}

function describe(watch: Watch, event: LoopEvent): string | null {
  const name = (id: string) => watch.loop.state.players[id]?.name ?? id;
  switch (event.kind) {
    case 'drawn': return `${name(event.attackerId)} הוגרל/ה להתקיף`;
    case 'finalStart': return 'הגמר מתחיל';
    case 'targeted': return `${name(event.setup.attackerId)} תוקף/ת את ${name(event.setup.defenderId)} (${CATEGORY_BY_ID[event.setup.categoryId].name})`;
    case 'resolved': return `דו־קרב ${event.duel}: ${event.resolution.summary}`;
    case 'continues': return `${name(event.playerId)} ממשיך/ה לתקוף`;
    case 'returned': return `${name(event.playerId)} חוזר/ת לזירה`;
    case 'champion': return `🏆 האלוף: ${name(event.championId)}`;
  }
}

function advance(watch: Watch) {
  if (isLoopDone(watch.loop)) {
    if (watch.timer) clearInterval(watch.timer);
    watch.timer = null;
    return;
  }
  const result = stepGame(watch.loop, watch.random);
  watch.loop = result.loop;
  if (result.event.kind === 'targeted') {
    watch.focus = { attackerId: result.event.setup.attackerId, defenderId: result.event.setup.defenderId };
  } else if (result.event.kind !== 'resolved') {
    watch.focus = null;
  }
  const line = describe(watch, result.event);
  if (line) watch.log = [line, ...watch.log].slice(0, 12);
}

function snapshot(watch: Watch) {
  const { state } = watch.loop;
  return {
    seed: watch.seed,
    duels: watch.loop.duels,
    done: isLoopDone(watch.loop),
    focus: watch.focus,
    cells: state.cells.map((cell) => ({ id: cell.id, ownerId: cell.ownerId })),
    players: Object.fromEntries(
      Object.values(state.players).map((player) => [
        player.id,
        { name: player.name, category: CATEGORY_BY_ID[player.categoryId].name, icon: CATEGORY_BY_ID[player.categoryId].icon, cells: player.cellIds.length, active: player.isActive },
      ]),
    ),
    log: watch.log,
  };
}

const PAGE = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>הזירה – צפייה בשרת</title>
<style>
:root{--bg:#0e1730;--card:#1b2748;--ink:#f4f6ff;--mute:#9aa7d0;--gold:#ffc247}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,Heebo,Arial,sans-serif;padding:12px 16px 24px}
h1{font-size:20px;margin:4px 0 2px}.sub{color:var(--mute);font-size:14px;margin-bottom:10px}
#board{direction:ltr;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-width:520px;margin:0 auto}
.cell{aspect-ratio:1;border-radius:12px;padding:6px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;font-size:12px;line-height:1.2;color:#fff;border:3px solid transparent;transition:background .5s,border-color .3s}
.cell b{font-size:13px}.cell small{opacity:.9}
.cell.att{border-color:#fff;box-shadow:0 0 0 2px #ff5d5d inset}.cell.def{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold) inset}
#log{max-width:520px;margin:14px auto 0;background:var(--card);border-radius:12px;padding:10px 14px;font-size:14px}
#log div{padding:3px 0;border-bottom:1px solid #ffffff14}#log div:first-child{font-weight:700;color:var(--gold)}
button{display:block;margin:14px auto 0;font:inherit;font-weight:700;background:var(--gold);color:#1a1a1a;border:0;border-radius:12px;padding:12px 22px}
.legend{max-width:520px;margin:8px auto 0;color:var(--mute);font-size:13px}
</style></head><body>
<h1>הזירה – השרת משחק</h1><div class="sub" id="sub">מתחבר…</div>
<div id="board"></div>
<div class="legend">מסגרת אדומה = התוקף · מסגרת זהב = המגן · מספר = גודל השטח</div>
<div id="log"></div><button id="again">משחק חדש</button>
<script>
const hue=id=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))%360;return h};
async function tick(){
  try{
    const s=await (await fetch('/api/watch')).json();
    document.getElementById('sub').textContent='דו־קרבות: '+s.duels+' / 15'+(s.done?' · המשחק נגמר':'');
    document.getElementById('board').innerHTML=s.cells.map(c=>{
      const p=s.players[c.ownerId];const f=s.focus;
      const cls='cell'+(f&&f.attackerId===c.ownerId?' att':'')+(f&&f.defenderId===c.ownerId?' def':'');
      return '<div class="'+cls+'" style="background:hsl('+hue(c.ownerId)+' 55% 38%)"><b>'+p.name+'</b><small>'+p.icon+' '+p.category+'</small><small>'+p.cells+' ריבועים</small></div>';
    }).join('');
    document.getElementById('log').innerHTML=s.log.map(l=>'<div>'+l+'</div>').join('');
  }catch(e){document.getElementById('sub').textContent='אין חיבור לשרת'}
}
document.getElementById('again').onclick=async()=>{await fetch('/api/watch/new',{method:'POST'});tick()};
tick();setInterval(tick,500);
</script></body></html>`;

export function mountWatch(app: any): void {
  app.get('/watch', (_req: any, res: any) => {
    if (!current) newGame();
    res.type('html').send(PAGE);
  });
  app.get('/api/watch', (_req: any, res: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(snapshot(current ?? newGame()));
  });
  app.post('/api/watch/new', (_req: any, res: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(snapshot(newGame()));
  });
}

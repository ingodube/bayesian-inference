import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pan,zoom,validView,copyView,frameWriter,touchNavigation} from '../src/touch-navigation.ts';
import {readPlot} from '../src/plotly-surface.ts';

const initial={x:[0,100],y:[0,50]}, box={left:10,top:20,width:200,height:100};
function fakeClock(){
  let now=0,id=0;const frames=new Map();
  return {now:()=>now,frame:fn=>{frames.set(++id,fn);return id;},cancel:i=>frames.delete(i),
    step(ms=16){now+=ms;const f=[...frames.values()];frames.clear();f.forEach(fn=>fn(now));},count:()=>frames.size};
}
function lab(reduced=false){
  const clock=fakeClock();let view=copyView(initial),taps=[];const writes=[];
  const host={read:()=>view,box:()=>box,initial,write:v=>{view=copyView(v);writes.push(copyView(v));},tap:p=>taps.push(p),reducedMotion:()=>reduced};
  return {clock,writes,taps,get view(){return view;},nav:touchNavigation(host,clock)};
}
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('pan follows the finger; pinch anchors both axes and is reversible',()=>{
  assert.deepEqual(pan(initial,20,10,box),{x:[-10,90],y:[5,55]});
  const anchor={x:60,y:45};
  const next=zoom(initial,anchor,anchor,.5,box,initial);
  assert.deepEqual(next,{x:[12.5,62.5],y:[18.75,43.75]});
  assert.deepEqual(zoom(next,anchor,anchor,2,box,initial),initial);
  const moved=zoom(initial,anchor,{x:80,y:55},1,box,initial);
  assert.deepEqual(moved,pan(initial,20,10,box));
});
test('limits reject invalid ranges and bound both zoom dimensions',()=>{
  const p={x:110,y:70};
  assert.deepEqual(zoom(initial,p,p,1e-20,box,initial),{x:[49.5,50.5],y:[24.75,25.25]});
  assert.deepEqual(zoom(initial,p,p,1e20,box,initial),{x:[-450,550],y:[-225,275]});
  assert(!validView({x:[1,1],y:[0,1]}));assert(!validView({x:[0,Infinity],y:[0,1]}));
  assert(!validView({x:[1e16,1e16+2],y:[0,1]}));
});
test('tap threshold, extra contacts and one/two/one transitions have no jumps',()=>{
  const l=lab(),n=l.nav;
  n.down(1,{x:50,y:50},0);n.move(1,{x:54,y:50},10);assert.equal(l.writes.length,0);
  n.up(1,{x:54,y:50},10);assert.equal(l.taps.length,1);
  n.down(1,{x:50,y:50},20);n.move(1,{x:70,y:50},30);
  const before=copyView(l.view);n.down(2,{x:110,y:50},40);
  assert.equal(n.down(3,{x:130,y:50},40),false);n.move(3,{x:160,y:70},50);assert.deepEqual(l.view,before);
  n.move(2,{x:150,y:50},50);const pinch=copyView(l.view);
  n.up(2,{x:150,y:50},60);n.move(1,{x:70,y:50},70);assert.deepEqual(l.view,pinch);
  n.up(1,{x:70,y:50},70);assert.equal(l.clock.count(),0,'no momentum after a pinch');
});
test('momentum decays, stops within one second and a new contact interrupts it',()=>{
  const l=lab(),n=l.nav,c=l.clock;
  n.down(1,{x:50,y:50},0);n.move(1,{x:70,y:50},20);n.move(1,{x:90,y:50},40);n.up(1,{x:90,y:50},40);
  const start=l.view.x[0];c.step(20);assert(l.view.x[0]<start);
  const a=l.view.x[0];c.step(20);const delta=Math.abs(l.view.x[0]-a);
  const b=l.view.x[0];c.step(20);assert(Math.abs(l.view.x[0]-b)<delta);
  n.down(2,{x:50,y:50},70);const stopped=copyView(l.view);c.step(100);assert.deepEqual(l.view,stopped);n.cancel();
  const other=lab();other.nav.down(1,{x:0,y:0},0);other.nav.move(1,{x:20,y:0},20);other.nav.up(1,{x:20,y:0},20);
  for(let i=0;i<70;i++)other.clock.step();assert.equal(other.clock.count(),0);
});
test('reduced motion, cancellation, independent panels and reset',()=>{
  const l=lab(true),other=lab(),n=l.nav;
  n.down(1,{x:0,y:0},0);n.move(1,{x:20,y:0},20);n.up(1,{x:20,y:0},20);assert.equal(l.clock.count(),0);
  assert.deepEqual(other.view,initial);
  n.reset();assert.deepEqual(l.view,initial);
  n.down(1,{x:0,y:0},0);n.cancel();n.move(1,{x:50,y:50},20);assert.deepEqual(l.view,initial);
  n.zoom(.5);near(l.view.x[1]-l.view.x[0],50);n.reset();assert.deepEqual(l.view,initial);
});
test('paused release does not create stale momentum',()=>{
  const l=lab();l.nav.down(1,{x:0,y:0},0);l.nav.move(1,{x:40,y:0},20);l.nav.up(1,{x:40,y:0},200);assert.equal(l.clock.count(),0);
});
test('viewport writes coalesce, serialize and drop obsolete pending work',async()=>{
  const clock=fakeClock(),calls=[];let finish;
  const writer=frameWriter(v=>{calls.push(v);return new Promise(r=>{finish=r;});},clock,e=>{throw e;});
  writer.submit(initial);writer.submit({x:[1,101],y:[0,50]});clock.step();await Promise.resolve();
  assert.equal(calls.length,1);assert.equal(calls[0].x[0],1);
  writer.submit({x:[2,102],y:[0,50]});writer.submit({x:[3,103],y:[0,50]});
  clock.step();assert.equal(calls.length,1);
  const drain=writer.stop();finish();await drain;clock.step();assert.equal(calls.length,1);
});
test('after a slow draw only the latest pending view renders, and errors drain',async()=>{
  const clock=fakeClock(),calls=[],errors=[];let finish;
  const writer=frameWriter(v=>{calls.push(v);return calls.length===1 ? new Promise(r=>{finish=r;}) : Promise.reject(Error('render failed'));},clock,e=>errors.push(e.message));
  writer.submit(initial);clock.step();await Promise.resolve();
  writer.submit({x:[1,101],y:[0,50]});writer.submit({x:[2,102],y:[0,50]});finish();
  await new Promise(r=>setImmediate(r));clock.step();await new Promise(r=>setImmediate(r));
  assert.deepEqual(calls.map(v=>v.x[0]),[0,2]);assert.deepEqual(errors,['render failed']);await writer.stop();
});
test('Plotly 3.1.0 surface contract reads rendered axes, not template autoranges',async()=>{
  const pkg=JSON.parse(await readFile('node_modules/plotly.js-basic-dist-min/package.json','utf8'));assert.equal(pkg.version,'3.1.0');
  const surface={getBoundingClientRect:()=>box};
  const graph={_fullLayout:{xaxis:{type:'linear',range:[2,8]},yaxis:{type:'linear',range:[0,4]}},querySelector:s=>s==='.nsewdrag'?surface:null};
  assert.deepEqual(readPlot(graph).view,{x:[2,8],y:[0,4]});assert.deepEqual(readPlot(graph).box,box);
  assert.throws(()=>readPlot({...graph,querySelector:()=>null}),/surface/);
});

import Plotly from "plotly.js-basic-dist-min";
import { copyView, frameWriter, touchNavigation } from "./touch-navigation";
import type { Clock, View } from "./touch-navigation";

import { readPlot } from "./plotly-surface";
export { readPlot } from "./plotly-surface";
const clock: Clock={frame:requestAnimationFrame.bind(window),cancel:cancelAnimationFrame.bind(window),now:()=>performance.now()};

export function attachNavigation(el: HTMLDivElement, initial: View, onError:(e:unknown)=>void) {
  const graph=el as any;
  let current=readPlot(graph).view, ownedWrite=false, disposed=false;
  const captured=new Set<number>();
  const writer=frameWriter(async view=>{
    ownedWrite=true;
    try { await Plotly.relayout(el,{"xaxis.range":view.x,"yaxis.range":view.y,"xaxis.autorange":false,"yaxis.autorange":false}); }
    finally { ownedWrite=false; }
  },clock,onError);
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const navigation=touchNavigation({
    initial:copyView(initial),read:()=>copyView(current),box:()=>readPlot(graph).box,
    reducedMotion:()=>reduced.matches,
    write:view=>{current=copyView(view); writer.submit(view);},
    tap:p=>{
      const {box}=readPlot(graph);
      const xval=current.x[0]+(p.x-box.left)/box.width*(current.x[1]-current.x[0]);
      const yval=current.y[1]-(p.y-box.top)/box.height*(current.y[1]-current.y[0]);
      (Plotly as any).Fx.hover(el,{xval,yval});
    },
  },clock);
  const isSurface=(target:EventTarget|null)=>target instanceof Element && !!target.closest(".nsewdrag");
  const point=(e:PointerEvent)=>({x:e.clientX,y:e.clientY});
  function release() {
    navigation.cancel();
    for (const id of captured) { if(el.hasPointerCapture(id))el.releasePointerCapture(id); }
    captured.clear();
  }
  const down=(e:PointerEvent)=>{
    if(e.pointerType!=="touch" || !isSurface(e.target))return;
    e.preventDefault(); e.stopImmediatePropagation();
    (Plotly as any).Fx.unhover(el);
    if(navigation.down(e.pointerId,point(e),e.timeStamp)) { captured.add(e.pointerId); el.setPointerCapture(e.pointerId); }
  };
  const move=(e:PointerEvent)=>{
    if(e.pointerType!=="touch" || !captured.has(e.pointerId))return;
    e.preventDefault(); e.stopImmediatePropagation(); navigation.move(e.pointerId,point(e),e.timeStamp);
  };
  const up=(e:PointerEvent)=>{
    if(!captured.has(e.pointerId))return;
    e.preventDefault(); e.stopImmediatePropagation();
    navigation.up(e.pointerId,point(e),e.timeStamp);
    captured.delete(e.pointerId);
    if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
  };
  const cancel=(e:PointerEvent)=>{if(captured.has(e.pointerId))release();};
  // Plotly also installs legacy touch handlers. Do not run them for the same gesture.
  const legacy=(e:TouchEvent)=>{
    if(navigation.active() || isSurface(e.target)) {e.preventDefault();e.stopImmediatePropagation();}
  };
  const changed=()=>{
    if(!disposed && !ownedWrite && !navigation.active()) current=readPlot(graph).view;
  };
  el.addEventListener("pointerdown",down,true); el.addEventListener("pointermove",move,true);
  el.addEventListener("pointerup",up,true); el.addEventListener("pointercancel",cancel,true);
  el.addEventListener("lostpointercapture",cancel,true);
  for(const event of ["touchstart","touchmove","touchend"] as const)el.addEventListener(event,legacy,{capture:true,passive:false});
  graph.on("plotly_relayout",changed);
  const reducedChanged=()=>{if(reduced.matches)release();};
  reduced.addEventListener("change",reducedChanged);
  return {
    reset:()=>{release();navigation.reset();},
    zoom:(factor:number)=>{release();navigation.zoom(factor);},
    key:(key:string)=>{
      const box=readPlot(graph).box;
      if(key==="ArrowLeft")navigation.shift(box.width*.1,0);
      else if(key==="ArrowRight")navigation.shift(-box.width*.1,0);
      else if(key==="ArrowUp")navigation.shift(0,box.height*.1);
      else if(key==="ArrowDown")navigation.shift(0,-box.height*.1);
    },
    snapshot:()=>copyView(current),
    cancel:release,
    detach() {
      disposed=true;release();
      el.removeEventListener("pointerdown",down,true);el.removeEventListener("pointermove",move,true);
      el.removeEventListener("pointerup",up,true);el.removeEventListener("pointercancel",cancel,true);
      el.removeEventListener("lostpointercapture",cancel,true);
      for(const event of ["touchstart","touchmove","touchend"] as const)el.removeEventListener(event,legacy,true);
      graph.removeListener("plotly_relayout",changed);reduced.removeEventListener("change",reducedChanged);
      return writer.stop();
    },
  };
}

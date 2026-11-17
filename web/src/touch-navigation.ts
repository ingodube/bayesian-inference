// View geometry only: no sampling, densities or statistical calculations.
export type Range = [number, number];
export type View = { x: Range; y: Range };
export type Point = { x: number; y: number };
export type Box = { left: number; top: number; width: number; height: number };
export const copyView = (v: View): View => ({ x: [...v.x], y: [...v.y] });
export const validRange = (r: Range) => r.every(Number.isFinite) &&
  Number.isFinite(r[1] - r[0]) && r[1] > r[0] &&
  r[1] - r[0] > 16 * Number.EPSILON * Math.max(Math.abs(r[0]), Math.abs(r[1]), Number.MIN_VALUE);
export const validView = (v: View) => validRange(v.x) && validRange(v.y);
export function pan(v: View, dx: number, dy: number, box: Box): View {
  const x = -dx / box.width * (v.x[1] - v.x[0]);
  const y = dy / box.height * (v.y[1] - v.y[0]);
  return { x: [v.x[0] + x, v.x[1] + x], y: [v.y[0] + y, v.y[1] + y] };
}
export function zoom(v: View, start: Point, end: Point, factor: number, box: Box, initial: View): View {
  const axis = (range: Range, base: Range, a: number, b: number): Range => {
    const span = range[1] - range[0], baseSpan = base[1] - base[0];
    const nextSpan = Math.max(baseSpan / 100, Math.min(baseSpan * 10, span * factor));
    const anchor = range[0] + a * span;
    return [anchor - b * nextSpan, anchor + (1 - b) * nextSpan];
  };
  return {
    x: axis(v.x, initial.x, (start.x-box.left)/box.width, (end.x-box.left)/box.width),
    y: axis(v.y, initial.y, 1-(start.y-box.top)/box.height, 1-(end.y-box.top)/box.height),
  };
}
type Frame = (callback: (time: number) => void) => number;
export type Clock = { frame: Frame; cancel: (id: number) => void; now: () => number };

// One render in flight, one replaceable pending viewport, at most one launch/frame.
export function frameWriter(write: (v: View) => Promise<unknown>, clock: Clock, error: (e: unknown) => void) {
  let pending: View | undefined, frame: number | undefined, running: Promise<unknown> | undefined, stopped = false;
  function schedule() {
    if (stopped || frame !== undefined || running || !pending) return;
    frame = clock.frame(() => {
      frame = undefined;
      const value = pending; pending = undefined;
      if (!value || stopped) return;
      running = Promise.resolve().then(() => write(value)).catch(error).finally(() => {
        running = undefined; schedule();
      });
    });
  }
  return {
    submit(v: View) { if (!stopped) { pending = copyView(v); schedule(); } },
    stop() {
      stopped = true; pending = undefined;
      if (frame !== undefined) clock.cancel(frame);
      frame = undefined;
      return running ?? Promise.resolve();
    },
  };
}

export function touchNavigation(host: {
  read: () => View; box: () => Box; initial: View;
  write: (v: View) => void; tap: (p: Point) => void; reducedMotion: () => boolean;
}, clock: Clock) {
  const pointers = new Map<number, Point>();
  let view = copyView(host.read()), origin = copyView(view), start: Point[] = [];
  let moved = false, pinched = false, history: { p: Point; t: number }[] = [];
  let animation: number | undefined;
  const points = () => [...pointers.values()];
  const center = (p: Point[]) => ({ x: (p[0].x+p[1].x)/2, y: (p[0].y+p[1].y)/2 });
  const distance = (p: Point[]) => Math.hypot(p[1].x-p[0].x, p[1].y-p[0].y);
  function stop() { if (animation !== undefined) clock.cancel(animation); animation = undefined; }
  function apply(next: View) { if (validView(next)) { view = next; host.write(next); } }
  function rebase() { start = points().map(p=>({...p})); origin = copyView(view); history = []; }
  function sample(p: Point, t: number) {
    history.push({p:{...p},t}); history = history.filter(s=>t-s.t<=80);
  }
  function inertia(t: number) {
    if (pinched || host.reducedMotion() || history.length < 2) return;
    const first=history[0], last=history.at(-1)!;
    if (t-last.t>80 || last.t<=first.t) return;
    const vx=(last.p.x-first.p.x)/(last.t-first.t)*1000;
    const vy=(last.p.y-first.p.y)/(last.t-first.t)*1000;
    const speed=Math.hypot(vx,vy), base=copyView(view), box=host.box();
    if (speed<10) return;
    const started=clock.now();
    const tick=(now:number)=>{
      const elapsed=Math.max(0,Math.min(1000,now-started));
      const decay=Math.exp(-elapsed/250), amount=.25*(1-decay);
      apply(pan(base,vx*amount,vy*amount,box));
      if (elapsed<1000 && speed*decay>=10) animation=clock.frame(tick); else animation=undefined;
    };
    animation=clock.frame(tick);
  }
  return {
    down(id:number,p:Point,t:number) {
      stop();
      if (pointers.size>=2) return false;
      if (!pointers.size) { view=copyView(host.read()); moved=false; pinched=false; }
      pointers.set(id,p); rebase(); sample(p,t);
      if (pointers.size===2) { pinched=true; moved=true; }
      return true;
    },
    move(id:number,p:Point,t:number) {
      if (!pointers.has(id)) return;
      pointers.set(id,p);
      const current=points();
      if (current.length===1) {
        const dx=p.x-start[0].x, dy=p.y-start[0].y;
        sample(p,t);
        if (!moved && Math.hypot(dx,dy)<6) return;
        moved=true; apply(pan(origin,dx,dy,host.box()));
      } else if (distance(start)>0 && distance(current)>0) {
        apply(zoom(origin,center(start),center(current),distance(start)/distance(current),host.box(),host.initial));
      }
    },
    up(id:number,p:Point,t:number) {
      if (!pointers.has(id)) return;
      pointers.delete(id);
      if (pointers.size) rebase();
      else if (!moved) host.tap(p);
      else inertia(t);
    },
    cancel() { stop(); pointers.clear(); history=[]; },
    reset() { this.cancel(); apply(copyView(host.initial)); },
    zoom(factor:number) {
      this.cancel(); view=copyView(host.read());
      const box=host.box(), p={x:box.left+box.width/2,y:box.top+box.height/2};
      apply(zoom(view,p,p,factor,box,host.initial));
    },
    shift(dx:number,dy:number) { this.cancel(); view=copyView(host.read()); apply(pan(view,dx,dy,host.box())); },
    active: () => pointers.size>0,
  };
}

import { useEffect, useId, useRef, useState } from "react";
import Plotly from "plotly.js-basic-dist-min";
import { attachNavigation, readPlot } from "./plotly-navigation";
import type { View } from "./touch-navigation";

export function Chart({figure,viewKey}:{figure:any;viewKey:string}) {
  const ref=useRef<HTMLDivElement>(null), hint=useId();
  const driver=useRef<ReturnType<typeof attachNavigation>|null>(null);
  const render=useRef<Promise<unknown>>(Promise.resolve());
  const initial=useRef<{key:string;view:View}|null>(null);
  const [error,setError]=useState(""),[ready,setReady]=useState(false);
  const [width,setWidth]=useState(0);
  useEffect(()=>{
    const el=ref.current!;
    let active=true;
    const previous=driver.current;
    const retained=initial.current?.key===viewKey ? previous?.snapshot() : undefined;
    const drained=previous?.detach(); driver.current=null;
    setReady(false);setError("");
    render.current=render.current.catch(()=>{}).then(async()=>{
      await drained;
      if(!active)return;
      const layout=structuredClone(figure.layout);
      layout.width=width || el.clientWidth;
      layout.uirevision=viewKey;
      if(retained) {
        layout.xaxis={...layout.xaxis,range:retained.x,autorange:false};
        layout.yaxis={...layout.yaxis,range:retained.y,autorange:false};
      }
      await Plotly.react(el,figure.data,layout,{responsive:false,displayModeBar:false,displaylogo:false,scrollZoom:false,doubleClick:false});
      if(!active)return;
      if(initial.current?.key!==viewKey)initial.current={key:viewKey,view:readPlot(el).view};
      driver.current=attachNavigation(el,initial.current.view,e=>{if(active)setError(String(e));});
      setReady(true);
    }).catch(e=>{if(active)setError(String(e));});
    return ()=>{active=false;};
  },[figure,viewKey,width]);
  useEffect(()=>{
    const el=ref.current!;
    let measuredWidth=0;
    const observer=new ResizeObserver(entries=>{
      const rect=entries[0].contentRect;
      if(rect.width===measuredWidth || rect.width<=0)return;
      measuredWidth=rect.width;
      driver.current?.cancel();
      setWidth(rect.width);
    });
    observer.observe(el);
    return ()=>{
      observer.disconnect();
      const drained=driver.current?.detach();driver.current=null;
      void render.current.finally(async()=>{await drained;Plotly.purge(el);});
    };
  },[]);
  return <div className="chart-shell">
    <div className="chart-tools" role="group" aria-label="Chart navigation">
      <button type="button" disabled={!ready} onClick={()=>driver.current?.zoom(.8)} aria-label="Zoom in">+</button>
      <button type="button" disabled={!ready} onClick={()=>driver.current?.zoom(1.25)} aria-label="Zoom out">−</button>
      <button type="button" disabled={!ready} onClick={()=>driver.current?.reset()}>Reset view</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <div ref={ref} className="chart" style={{height:figure.layout.height ?? 350}} tabIndex={0} aria-label="Interactive statistical chart" aria-describedby={hint}
      onKeyDown={e=>{
        if(!ready || e.ctrlKey || e.metaKey || e.altKey)return;
        if(e.key.startsWith("Arrow")){e.preventDefault();driver.current?.key(e.key);}
        else if(e.key==="+" || e.key==="="){e.preventDefault();driver.current?.zoom(.8);}
        else if(e.key==="-"){e.preventDefault();driver.current?.zoom(1.25);}
        else if(e.key==="Home"){e.preventDefault();driver.current?.reset();}
      }}/>
    <p id={hint} className="chart-hint">Drag to pan · Pinch to zoom · Scroll outside the plot to move the page</p>
  </div>;
}

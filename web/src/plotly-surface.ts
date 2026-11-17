import { validView } from "./touch-navigation.ts";
import type { View, Box } from "./touch-navigation.ts";

// Plotly 3.1.0 compatibility boundary. Keep private layout/drag-surface reads here.
export function readPlot(el: any): { view: View; box: Box; surface: Element } {
  const layout=el._fullLayout, surface=el.querySelector(".nsewdrag");
  if (!layout || layout.xaxis.type!=="linear" || layout.yaxis.type!=="linear" || !surface)
    throw Error("This chart does not expose the expected Plotly navigation surface.");
  const view: View={x:[layout.xaxis.range[0],layout.xaxis.range[1]],y:[layout.yaxis.range[0],layout.yaxis.range[1]]};
  const rect=surface.getBoundingClientRect();
  if (!validView(view) || !(rect.width>0 && rect.height>0)) throw Error("Chart navigation is not ready.");
  return {view,box:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},surface};
}

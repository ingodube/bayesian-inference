import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {posteriorFigure} from '../src/figures.mjs';
test('every audited posterior has finite axes, aligned curves and exact interval endpoints',async()=>{
 const cases=JSON.parse(await readFile('../artifacts/stress-fixtures.json','utf8'));
 const defs=JSON.parse(await readFile('public/figures.json','utf8'));
 const bindings=JSON.parse(await readFile('public/bindings.json','utf8'));
 for(const {result} of cases)for(const panel of result.panels)for(const expanded of [false,true]){
  const f=posteriorFigure(defs,bindings,panel,expanded);
  assert(f.layout.xaxis.range.every(Number.isFinite));assert(f.layout.yaxis.range.every(Number.isFinite));
  assert(f.layout.yaxis.range[1]>0);
  for(const trace of f.data){assert.equal(trace.x.length,trace.y.length);assert(trace.x.every(Number.isFinite));assert(trace.y.every(Number.isFinite));}
  assert.equal(f.data[0].x[0],panel.summary.interval.lower);
  assert.equal(f.data[0].x.at(-1),panel.summary.interval.upper);
  if(expanded)assert(panel.truth>=f.layout.xaxis.range[0]&&panel.truth<=f.layout.xaxis.range[1]);
 }
});

import { WebR, ChannelType } from "webr";
import type { Request, Result } from "./types";
import { latestQueue } from "./latest-queue.mjs";
const base = import.meta.env.BASE_URL;
let runtime: WebR | undefined;
let loading: Promise<WebR> | undefined;
async function load() {
  if (!loading)
    loading = (async () => {
      const r = new WebR({
        baseUrl: new URL(`${base}vendor/webr/`, location.origin).href,
        channelType: ChannelType.PostMessage,
        interactive: false,
      });
      runtime = r;
      await r.init();
      const response = await fetch(`${base}engine.R`);
      if (!response.ok)
        throw new Error("Could not load the R statistical kernel.");
      await r.evalRVoid(await response.text());
      return r;
    })().catch((e) => {
      loading = undefined;
      throw e;
    });
  return loading;
}
const createScheduler = () =>
  latestQueue(async (request: Request): Promise<Result> => {
    const r = await load();
    const shelter = await new r.Shelter();
    try {
      const input = await new shelter.RList(request as any);
      // Bind data as an R object. User values never become executable R source.
      await r.objs.globalEnv.bind("lab_request", input);
      const value = await shelter.evalR("run_json(lab_request)");
      const json = await (value as any).toString();
      return JSON.parse(json) as Result;
    } finally {
      await shelter.purge();
    }
  });
let schedule = createScheduler();
export function compute(request: Request): Promise<Result> {
  return schedule(request);
}
export function restartEngine() {
  schedule.cancel();
  try {
    runtime?.close();
  } finally {
    runtime = undefined;
    loading = undefined;
    schedule = createScheduler();
  }
}

export type Model =
  | "bernoulli"
  | "binomial"
  | "geometric"
  | "poisson"
  | "normal"
  | "exponential"
  | "gamma"
  | "rayleigh";
export interface Request {
  model: Model;
  gen: Record<string, number>;
  mode: string;
  n: number;
  seed: number;
  level: number;
  prior: {
    family: string;
    a: number;
    b: number;
    m: number;
    v: number;
    k: number;
  };
  scale: string;
}
export interface Moment {
  value: number | null;
  status: string;
  reason: string;
}
export interface Summary {
  mean: Moment;
  median: Moment;
  variance: Moment;
  mode: { values: number | number[]; status: string };
  interval: { lower: number | null; upper: number | null; width: number | null; level: number; status: string };
}
export interface Panel {
  plot_note?: string;
  target: string;
  truth: number;
  posterior: Record<string, unknown>;
  prior: Record<string, unknown> | null;
  summary: Summary;
  prior_summary: Summary | null;
  curve: { x: number[]; y: number[] };
  prior_curve: { x: number[]; y: number[] } | null;
  shade: { x: number[]; y: number[] };
  focus: number[];
  expanded: number[];
  boundary_note: string;
}
export interface Result {
  status: string;
  message?: string;
  request: Request;
  sample: {
    values: number[];
    n: number;
    mean: number;
    variance: number;
    sum: number;
    sum_squares: number;
    r_version: string;
    rng: string;
  };
  observed: Record<string, any>;
  panels: Panel[];
  note: string;
  formula: string;
}
export interface Field {
  key: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
}
export interface ModelSpec {
  label: string;
  description: string;
  fields: Field[];
  parameter: string;
  family: string;
}

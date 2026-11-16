import type { Model, ModelSpec } from "./types";
export const catalog: Record<Model, ModelSpec> = {
  bernoulli: {
    label: "Bernoulli",
    description: "A single success (1) or failure (0) per observation.",
    parameter: "success probability p",
    family: "Beta",
    fields: [
      {
        key: "p",
        label: "Generating probability",
        value: 0.4,
        min: 0,
        max: 1,
        step: 0.01,
      },
    ],
  },
  binomial: {
    label: "Binomial",
    description:
      "Each observation counts successes in m known trials. n observations contain n × m trials.",
    parameter: "success probability p",
    family: "Beta",
    fields: [
      {
        key: "p",
        label: "Generating probability",
        value: 0.4,
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: "m",
        label: "Known trials per observation",
        value: 10,
        min: 1,
        step: 1,
      },
    ],
  },
  geometric: {
    label: "Geometric",
    description: "Counts failures before the first success: 0, 1, 2, …",
    parameter: "success probability p",
    family: "Beta",
    fields: [
      {
        key: "p",
        label: "Generating probability",
        value: 0.3,
        min: 0.00001,
        max: 1,
        step: 0.01,
      },
    ],
  },
  poisson: {
    label: "Poisson",
    description: "Independent event counts with equal, unit exposure.",
    parameter: "rate lambda",
    family: "Gamma",
    fields: [
      {
        key: "rate",
        label: "Generating rate",
        value: 4,
        min: 0.00001,
        step: 0.1,
      },
    ],
  },
  normal: {
    label: "Normal",
    description:
      "A continuous distribution with a mean and a variance. Declare what is known to the inference.",
    parameter: "",
    family: "",
    fields: [
      { key: "mean", label: "Generating mean", value: 5, step: 0.5 },
      {
        key: "variance",
        label: "Generating variance",
        value: 30,
        min: 0.00001,
        step: 1,
        help: "This is variance, not standard deviation.",
      },
    ],
  },
  exponential: {
    label: "Exponential",
    description:
      "Positive waiting times with a constant event rate. Mean waiting time is 1 / rate.",
    parameter: "rate lambda",
    family: "Gamma",
    fields: [
      {
        key: "rate",
        label: "Generating rate",
        value: 1,
        min: 0.00001,
        step: 0.1,
      },
    ],
  },
  gamma: {
    label: "Gamma",
    description:
      "Positive measurements with known shape and unknown rate. This version requires the shape to be known.",
    parameter: "rate lambda",
    family: "Gamma",
    fields: [
      {
        key: "shape",
        label: "Generating / known shape",
        value: 3,
        min: 0.00001,
        step: 0.1,
      },
      {
        key: "rate",
        label: "Generating rate",
        value: 1,
        min: 0.00001,
        step: 0.1,
      },
    ],
  },
  rayleigh: {
    label: "Rayleigh",
    description:
      "Nonnegative magnitudes. Location is fixed at zero. Conjugate inference is on the squared scale.",
    parameter: "squared scale sigma²",
    family: "Inverse-Gamma",
    fields: [
      {
        key: "scale",
        label: "Generating scale sigma",
        value: 2,
        min: 0.00001,
        step: 0.1,
      },
    ],
  },
};
export const priorFamily = (model: Model, mode: string) =>
  model === "normal"
    ? ({
        mean: "Normal",
        variance: "Inverse-Gamma",
        both: "Normal–Inverse-Gamma",
      }[mode] ?? "")
    : catalog[model].family;

// At most one running request and one pending request. New pending work replaces old work.
export function latestQueue(worker) {
  let running = false,
    pending;
  async function drain(job) {
    running = true;
    try {
      job.resolve(await worker(job.input));
    } catch (error) {
      job.reject(error);
    } finally {
      if (pending) {
        const next = pending;
        pending = undefined;
        void drain(next);
      } else running = false;
    }
  }
  const enqueue = (input) =>
    new Promise((resolve, reject) => {
      const job = { input, resolve, reject };
      if (running) {
        pending?.reject(new Error("Superseded by a newer experiment."));
        pending = job;
      } else void drain(job);
    });
  return Object.assign(enqueue, {
    cancel() {
      pending?.reject(new Error("The R engine was restarted."));
      pending = undefined;
    },
  });
}

/**
 * `fn` run one call at a time: a call made while another runs waits for it, then runs (in the
 * order asked), whether the one before resolved or threw. Each call resolves or rejects with
 * its own result. main.js pagesOp: two page ops never write to disk at once, and each reads
 * the files the one before wrote.
 */
export function oneAtATime(fn) {
  let last = Promise.resolve();
  return (...args) => {
    const run = last.then(() => fn(...args));
    last = run.catch(() => {});
    return run;
  };
}

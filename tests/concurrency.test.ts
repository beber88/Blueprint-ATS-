import pLimit from "p-limit";

describe("p-limit concurrency guard", () => {
  it("never lets more than `limit` tasks run simultaneously", async () => {
    const LIMIT = 10;
    const TOTAL = 20;
    const limit = pLimit(LIMIT);
    let inFlight = 0;
    let observedMax = 0;

    const tasks = Array.from({ length: TOTAL }, () =>
      limit(async () => {
        inFlight += 1;
        observedMax = Math.max(observedMax, inFlight);
        // Yield to the event loop so other tasks can start (or be blocked).
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        inFlight -= 1;
      })
    );
    await Promise.all(tasks);
    expect(observedMax).toBeLessThanOrEqual(LIMIT);
    expect(observedMax).toBe(LIMIT); // we should saturate the limit
  });

  it("processes all tasks even when total >> limit", async () => {
    const limit = pLimit(3);
    const results: number[] = [];
    const tasks = Array.from({ length: 30 }, (_, i) =>
      limit(async () => {
        await new Promise((r) => setImmediate(r));
        results.push(i);
      })
    );
    await Promise.all(tasks);
    expect(results).toHaveLength(30);
    expect(new Set(results).size).toBe(30);
  });
});

import { defineConfig } from "vitest/config";

// The balance simulations, kept apart from the normal tests. See src/sim/economy.sim.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/sim/**/*.sim.ts"],
    testTimeout: 300_000,
  },
});

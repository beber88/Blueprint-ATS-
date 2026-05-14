/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Don't try to compile Next.js / TSX / app router files — we only test
  // pure server/lib helpers here.
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  // The DB-integration test files share a single Postgres instance and a
  // single `public` schema. Running them in parallel workers triggers a
  // race on dropAndRecreate. Force serial execution. Deterministic tests
  // are fast (<100ms total) so the speed cost is negligible.
  maxWorkers: 1,
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "preserve", esModuleInterop: true, module: "commonjs", target: "es2020", moduleResolution: "node", strict: false, skipLibCheck: true, resolveJsonModule: true, baseUrl: ".", paths: { "@/*": ["./*"] } } }],
  },
  // Coverage scope: every file under lib/ except declaration files,
  // glue / Supabase wrappers, and files not yet covered by tests.
  // See docs/operations/backlog/BACKLOG_operations_test_coverage.md for
  // the plan to bring digest / queries inside the gate.
  collectCoverageFrom: [
    "lib/**/*.{ts,tsx}",
    "!lib/**/*.d.ts",
    "!lib/supabase/**",
    // Glue / thin Supabase wrappers — no branching logic worth gating.
    "!lib/operations/draft-master-snapshot.ts",
    // Read-side query + digest formatting + employee/name matchers —
    // real logic, but their direct tests don't exist yet (they're
    // exercised indirectly via promoteDraft etc. with mocks).
    // Backlog: BACKLOG_operations_test_coverage.md.
    "!lib/operations/digest.ts",
    "!lib/operations/queries.ts",
    "!lib/operations/match-employee.ts",
    // Same exclusions for contracts module: glue + read-side query helpers
    // covered indirectly via promote/cron paths but not directly tested.
    "!lib/contracts/draft-master-snapshot.ts",
    "!lib/contracts/queries.ts",
    // AI extractor: not covered directly (mocking Anthropic is heavy and
    // the extractor is mostly defensive defaults). Backlog item alongside
    // lib/claude/extract-report.ts's missing coverage.
    "!lib/contracts/extract-contract.ts",
    "!**/node_modules/**",
  ],
  // CI gate. If any file under lib/operations/* or lib/contracts/* falls
  // below these numbers CI fails. Branches at 70 (not 80) because
  // early-return / warning-path branches tend to drift more than statement
  // coverage on small PRs — we'd rather the gate not cry wolf on a
  // one-line bug fix.
  coverageThreshold: {
    "./lib/operations/**/*.{ts,tsx}": {
      statements: 80,
      lines: 80,
      functions: 80,
      branches: 70,
    },
    "./lib/contracts/**/*.{ts,tsx}": {
      statements: 80,
      lines: 80,
      functions: 80,
      branches: 70,
    },
  },
};

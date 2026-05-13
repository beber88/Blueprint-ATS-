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
};

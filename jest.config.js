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
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "preserve", esModuleInterop: true, module: "commonjs", target: "es2020", moduleResolution: "node", strict: false, skipLibCheck: true, resolveJsonModule: true, baseUrl: ".", paths: { "@/*": ["./*"] } } }],
  },
};

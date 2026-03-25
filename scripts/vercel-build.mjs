import { spawnSync } from "node:child_process";

function resolveEnvValue(...candidates) {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const databaseUrl = resolveEnvValue(
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_URL_NON_POOLING,
);

const directUrl = resolveEnvValue(
  process.env.DIRECT_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL_NON_POOLING,
);

const buildEnv = {
  ...process.env,
  ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
  ...(directUrl ? { DIRECT_URL: directUrl } : {}),
};

run("pnpm", ["prisma:generate"], buildEnv);
run("pnpm", ["prisma:migrate"], buildEnv);
run("pnpm", ["build:client"], buildEnv);

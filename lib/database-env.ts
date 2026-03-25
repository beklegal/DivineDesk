type EnvironmentLike = Record<string, string | undefined>;

function normalizeOptionalEnvironmentValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getFirstConfiguredValue(
  environment: EnvironmentLike,
  keys: readonly string[],
) {
  for (const key of keys) {
    const resolved = normalizeOptionalEnvironmentValue(environment[key]);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

const RUNTIME_DATABASE_URL_KEYS = [
  "DIVINEDESK_DATABASE_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
  "DIRECT_URL",
] as const;

const PRISMA_DATABASE_URL_KEYS = [
  "DIRECT_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "POSTGRES_URL",
] as const;

export function getRuntimeDatabaseUrl(environment: EnvironmentLike = process.env) {
  return getFirstConfiguredValue(environment, RUNTIME_DATABASE_URL_KEYS);
}

export function getPrismaDatabaseUrl(environment: EnvironmentLike = process.env) {
  return getFirstConfiguredValue(environment, PRISMA_DATABASE_URL_KEYS);
}

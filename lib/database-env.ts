type EnvironmentLike = Record<string, string | undefined>;

function normalizeOptionalEnvironmentValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isPlaceholderDatabaseUrl(value: string) {
  const normalized = value.toLowerCase();

  return (
    normalized.includes("username:password@") ||
    normalized.includes("your-neon-host") ||
    normalized.includes("replace-with") ||
    normalized.includes("<username>") ||
    normalized.includes("<password>") ||
    normalized.includes("<host>")
  );
}

function isSupportedDatabaseProtocol(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
  } catch {
    return false;
  }
}

export interface ResolvedDatabaseConfig {
  key: string;
  value: string;
}

function isVercelEnvironment(environment: EnvironmentLike) {
  const value = normalizeOptionalEnvironmentValue(environment.VERCEL);
  return value === "1" || value === "true";
}

function getRuntimeDatabaseKeys(environment: EnvironmentLike) {
  if (isVercelEnvironment(environment)) {
    return [
      "DIVINEDESK_DATABASE_URL",
      "POSTGRES_URL",
      "DATABASE_URL",
      "POSTGRES_URL_NON_POOLING",
      "DATABASE_URL_UNPOOLED",
      "POSTGRES_PRISMA_URL",
      "DIRECT_URL",
    ] as const;
  }

  return [
    "DIVINEDESK_DATABASE_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
    "DIRECT_URL",
  ] as const;
}

function getPrismaDatabaseKeys(environment: EnvironmentLike) {
  if (isVercelEnvironment(environment)) {
    return [
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL_NON_POOLING",
      "DIRECT_URL",
      "DATABASE_URL_UNPOOLED",
      "DATABASE_URL",
      "POSTGRES_URL",
    ] as const;
  }

  return [
    "DIRECT_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL",
    "POSTGRES_URL",
  ] as const;
}

function getFirstConfiguredValue(
  environment: EnvironmentLike,
  keys: readonly string[],
) {
  for (const key of keys) {
    const resolved = normalizeOptionalEnvironmentValue(environment[key]);
    if (resolved && isSupportedDatabaseProtocol(resolved) && !isPlaceholderDatabaseUrl(resolved)) {
      return resolved;
    }
  }

  return null;
}

export function getRuntimeDatabaseUrl(environment: EnvironmentLike = process.env) {
  return getFirstConfiguredValue(environment, getRuntimeDatabaseKeys(environment));
}

export function getPrismaDatabaseUrl(environment: EnvironmentLike = process.env) {
  return getFirstConfiguredValue(environment, getPrismaDatabaseKeys(environment));
}

export function getResolvedRuntimeDatabaseConfig(
  environment: EnvironmentLike = process.env,
): ResolvedDatabaseConfig | null {
  for (const key of getRuntimeDatabaseKeys(environment)) {
    const value = normalizeOptionalEnvironmentValue(environment[key]);

    if (value && isSupportedDatabaseProtocol(value) && !isPlaceholderDatabaseUrl(value)) {
      return { key, value };
    }
  }

  return null;
}

export function getResolvedPrismaDatabaseConfig(
  environment: EnvironmentLike = process.env,
): ResolvedDatabaseConfig | null {
  for (const key of getPrismaDatabaseKeys(environment)) {
    const value = normalizeOptionalEnvironmentValue(environment[key]);

    if (value && isSupportedDatabaseProtocol(value) && !isPlaceholderDatabaseUrl(value)) {
      return { key, value };
    }
  }

  return null;
}

function ensureLeadingSlash(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

function removeTrailingSlash(value: string) {
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

export function normalizeVercelFunctionUrl(url: string | null | undefined, mountPrefix: string) {
  const normalizedMountPrefix = removeTrailingSlash(ensureLeadingSlash(mountPrefix));
  const rawUrl = typeof url === "string" && url.trim() ? url.trim() : "/";
  const [rawPathname, rawQuery = ""] = rawUrl.split("?", 2);
  const pathname = ensureLeadingSlash(rawPathname || "/");

  let normalizedPathname = pathname;

  if (!pathname.startsWith("/api")) {
    const mountWithoutApi = normalizedMountPrefix.replace(/^\/api/, "");

    if (mountWithoutApi && (pathname === mountWithoutApi || pathname.startsWith(`${mountWithoutApi}/`))) {
      normalizedPathname = `/api${pathname}`;
    } else if (pathname === "/") {
      normalizedPathname = normalizedMountPrefix;
    } else {
      normalizedPathname = `${normalizedMountPrefix}${pathname}`;
    }
  }

  return rawQuery ? `${normalizedPathname}?${rawQuery}` : normalizedPathname;
}

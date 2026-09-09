/**
 * Canonical origin.
 *
 * `www.onecrate.io` is canonical; the apex redirects to it. The apex is pinned
 * to the Container Apps environment's static inbound IP (Wix cannot delegate
 * nameservers, so CNAME flattening is unavailable and the apex must be an A
 * record). If that environment is ever rebuilt the IP goes stale — with www
 * canonical, a stale apex breaks a redirect rather than the application.
 *
 * Everything that needs an absolute URL reads from here: auth callbacks, cookie
 * domain, metadata, CORS. Never hardcode the hostname anywhere else.
 *
 * Runtime-resolved, not build-time. The promote pipeline ships one image tag to
 * both dev and prod, so a value baked at `next build` could not differ between
 * them.
 */

const DEV_ORIGIN = "http://localhost:3000";

/**
 * `next build` runs with NODE_ENV=production but no runtime secrets — the image
 * is built once and the environment is injected per deployment. Throwing on a
 * missing APP_ORIGIN at module scope would therefore fail the build rather than
 * catch a misconfiguration, so during the build phase we fall back instead.
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** e.g. "https://www.onecrate.io" — no trailing slash. */
export function canonicalOrigin(): string {
  const origin = process.env.APP_ORIGIN;

  if (!origin) {
    // Local dev has no ingress in front of it and no canonical host to enforce.
    if (process.env.NODE_ENV !== "production") return DEV_ORIGIN;
    if (isBuildPhase()) return DEV_ORIGIN;
    throw new Error("APP_ORIGIN is not set. It is required in production.");
  }

  return origin.replace(/\/+$/, "");
}

/** Host portion only, e.g. "www.onecrate.io". Used for host comparison in Proxy. */
export function canonicalHost(): string {
  return new URL(canonicalOrigin()).host;
}

/** Absolute URL against the canonical origin. */
export function absoluteUrl(path: string): string {
  return new URL(path, canonicalOrigin() + "/").toString();
}

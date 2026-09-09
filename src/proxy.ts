import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

import { canonicalHost, canonicalOrigin } from "@/lib/site";

/**
 * Proxy — Next 16's name for what used to be Middleware. Two jobs, in order:
 * canonicalize the host, then pre-filter unauthenticated requests.
 *
 * The auth check here is deliberately optimistic: it only looks for the session
 * cookie and never touches SQL. Proxy runs on every request including prefetches,
 * so a database round-trip here would be paid on links the user never clicks.
 * The real check is in the DAL, next to the data (lib/dal.ts).
 */

const PROTECTED = ["/fleet"];
const PUBLIC = ["/", "/login"];

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  /**
   * Apex → www. Runtime rather than a next.config redirect because that is
   * baked into the routes manifest at build time, and the promote pipeline ships
   * one image tag to both dev and prod.
   *
   * www is canonical because the apex is pinned to the Container Apps
   * environment's static inbound IP (Wix cannot delegate nameservers, so no
   * CNAME flattening at the apex). If that IP goes stale, a stale apex breaks a
   * redirect instead of the application.
   */
  const host = req.headers.get("host");
  const canonical = canonicalHost();
  if (host && host !== canonical && !isServedDirectly(host)) {
    return NextResponse.redirect(`${canonicalOrigin()}${pathname}${search}`, 308);
  }

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isPublic = PUBLIC.includes(pathname);

  // Presence only — not a validity claim. getSessionCookie does no I/O.
  const hasSession = getSessionCookie(req);

  if (isProtected && !hasSession) {
    const login = new URL("/login", redirectBase(req));
    // Send them back where they were headed once signed in.
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/fleet", redirectBase(req)));
  }

  void isPublic;
  return NextResponse.next();
}

/**
 * Hosts served as-is rather than redirected to the canonical origin.
 *
 * Local covers dev and in-cluster probes. The `.azurecontainerapps.io` FQDN is
 * the one Azure assigns this app: it always has a valid certificate, and with a
 * single production environment it is the ONLY way to inspect a deploy before
 * the onecrate.io DNS records exist. Redirecting it away would leave the first
 * deploy unverifiable.
 *
 * Note that signing in still requires the canonical host — Better Auth's
 * trustedOrigins is pinned to APP_ORIGIN, so an auth POST from the FQDN is
 * rejected. Reaching the FQDN proves the container runs and serves; it is not a
 * second front door.
 */
function isServedDirectly(host: string): boolean {
  const hostname = host.split(":")[0];
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".azurecontainerapps.io")
  );
}

/**
 * Base URL for redirects issued from here.
 *
 * Not `req.nextUrl`: behind the Container Apps ingress the app is reached over
 * plain http on an internal address, and nextUrl reflects that rather than the
 * X-Forwarded-Proto/Host the ingress sets. Building on it emits a Location of
 * `http://<internal>:3000/login` — an address the client cannot reach, and http
 * where the session cookie is Secure.
 *
 * The canonical origin is authoritative and already known, so use it. Requests
 * that genuinely are local (dev, health probes) keep their own origin.
 */
function redirectBase(req: NextRequest): string {
  const host = req.headers.get("host");
  if (!host) return canonicalOrigin();

  const hostname = host.split(":")[0];

  // Dev: nextUrl is accurate, and http is correct here.
  if (hostname === "localhost" || hostname === "127.0.0.1") return req.nextUrl.origin;

  // Azure FQDN: build from the Host header, NOT nextUrl. Behind ingress nextUrl
  // is the internal listen address, so falling back to it emits a Location of
  // http://<internal>:3000/login — unreachable, and http where the session
  // cookie is Secure. Ingress always terminates TLS, so https is right.
  if (hostname.endsWith(".azurecontainerapps.io")) return `https://${host}`;

  return canonicalOrigin();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|txt)$).*)"],
};

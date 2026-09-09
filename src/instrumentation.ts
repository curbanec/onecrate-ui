/**
 * Startup environment check.
 *
 * Runs once when the server boots. Exists because several of these failures are
 * silent rather than loud: Better Auth falls back to a *default* signing secret
 * when BETTER_AUTH_SECRET is unset — sessions still work, they are just forgeable
 * by anyone who knows the default. A container that cannot serve safely should
 * refuse to start rather than serve wrongly.
 */

const REQUIRED = [
  "APP_ORIGIN",
  "BETTER_AUTH_SECRET",
  "AUTH_DB_SERVER",
  "AUTH_DB_NAME",
  "AUTH_DB_USER",
  "AUTH_DB_PASSWORD",
] as const;

export async function register() {
  // The build collects page data in this phase without runtime secrets.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Refusing to start. Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  if (!process.env.APP_ORIGIN?.startsWith("https://")) {
    throw new Error(
      `Refusing to start. APP_ORIGIN must be https in production, got: ${process.env.APP_ORIGIN}`,
    );
  }
}

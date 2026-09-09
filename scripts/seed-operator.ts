/**
 * Provision an operator account and their organization.
 *
 * Public signup is disabled on the app's auth instance (see lib/auth.ts), so
 * accounts are created here instead. This builds its own Better Auth instance
 * against the same database with signup enabled — same tables, same password
 * hashing, no reaching into internals that can change between versions.
 *
 *   npx tsx --env-file=.env.local scripts/seed-operator.ts
 *
 * Credentials come from the environment rather than argv so the password does
 * not land in shell history or the process list.
 *
 *   SEED_EMAIL, SEED_PASSWORD, SEED_NAME, SEED_ORG_NAME, SEED_ORG_SLUG
 *
 * Safe to re-run: it reports and exits rather than duplicating an existing user.
 */

import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

import { createMssqlDialect } from "../src/lib/auth-db";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const email = required("SEED_EMAIL");
  const password = required("SEED_PASSWORD");
  const name = process.env.SEED_NAME ?? email.split("@")[0];
  const orgName = process.env.SEED_ORG_NAME ?? "OneCrate";
  const orgSlug = process.env.SEED_ORG_SLUG ?? "onecrate";

  if (password.length < 8) {
    console.error("SEED_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  // Same database and secret as the app; signup enabled only for this process.
  const seedAuth = betterAuth({
    database: { dialect: createMssqlDialect(), type: "mssql" },
    baseURL: process.env.APP_ORIGIN ?? "http://localhost:3000",
    emailAndPassword: { enabled: true, disableSignUp: false },
    plugins: [organization()],
  });

  let userId: string;
  try {
    const result = await seedAuth.api.signUpEmail({
      body: { email, password, name },
    });
    userId = result.user.id;
    console.log(`Created user ${email} (${userId})`);
  } catch (error) {
    console.error(
      `Could not create ${email}. If the account already exists this is expected.`,
    );
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  /**
   * System action: passing userId with no session creates the organization with
   * that user as owner. This is the tenant every Fleet query will be scoped by.
   */
  try {
    const org = await seedAuth.api.createOrganization({
      body: { name: orgName, slug: orgSlug, userId },
    });
    console.log(`Created organization ${orgName} (${org?.id ?? "unknown id"})`);
  } catch (error) {
    console.error(
      `User created, but organization "${orgSlug}" was not. It may already exist —` +
        ` in that case add the user as a member rather than re-running this.`,
    );
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log("Done. Sign in at /login.");
  process.exit(0);
}

void main();

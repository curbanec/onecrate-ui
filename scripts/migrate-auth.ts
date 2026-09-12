/**
 * Create or update the auth tables.
 *
 * Replaces `npx @better-auth/cli migrate`, which cannot be used here: it loads
 * src/lib/auth.ts through jiti, where `import "server-only"` does not resolve
 * (Next bundles that package; it is not in node_modules), and the published CLI
 * stopped at 1.4.x while this app runs better-auth 1.7. This calls the same
 * migration planner the CLI does, from the installed better-auth.
 *
 *   npm run auth:generate   # print the SQL, apply nothing
 *   npm run auth:migrate    # apply it
 *
 * The schema is derived from the plugin list, so `plugins` here must match
 * lib/auth.ts. A plugin added there and not here is a table that never gets
 * created — and that surfaces as a failed sign-in, not as an error here.
 *
 * Safe to re-run: it diffs against the live database and applies only what is
 * missing.
 */

import { organization } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";

import { createMssqlDialect } from "../src/lib/auth-db";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { toBeCreated, toBeAdded, toBeAddedIndexes, runMigrations, compileMigrations } =
    await getMigrations({
      database: { dialect: createMssqlDialect(), type: "mssql" },
      emailAndPassword: { enabled: true },
      plugins: [organization()],
    });

  if (toBeCreated.length + toBeAdded.length + toBeAddedIndexes.length === 0) {
    console.log("Auth schema is up to date.");
    process.exit(0);
  }

  for (const { table } of toBeCreated) console.log(`create table ${table}`);
  for (const { table, fields } of toBeAdded) {
    console.log(`add ${Object.keys(fields).join(", ")} to ${table}`);
  }
  for (const { table, name } of toBeAddedIndexes) console.log(`add index ${name} on ${table}`);

  if (dryRun) {
    console.log(`\n${await compileMigrations()}`);
    process.exit(0);
  }

  await runMigrations();
  console.log("Done. Next: npm run seed:operator");
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

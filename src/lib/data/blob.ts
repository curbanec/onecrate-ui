import "server-only";

import { BlobServiceClient } from "@azure/storage-blob";

import {
  DEPLOYED_CONTAINER,
  deployedBlobName,
  type DeploymentEnv,
} from "./environment";

/**
 * Reads the deployment manifest out of blob storage.
 *
 * The container and blob names mirror the platform's own writer exactly
 * (`deployments/deployed.{dev,prod}.json`), because the pipelines upload to
 * those paths on every deploy and this app is only a reader.
 */

/**
 * Connection string for an environment's manifest.
 *
 * Both manifests currently live in the same storage account, so
 * `STORAGE_CONNECTION_STRING` alone is sufficient and is what Bicep wires. The
 * per-environment overrides exist because dev and prod pipelines draw from
 * separate Azure DevOps variable groups, so the accounts are free to diverge
 * later — at which point this is configuration, not a code change.
 */
export function resolveStorageConnectionString(environment: DeploymentEnv): string {
  const override =
    environment === "prod"
      ? process.env.STORAGE_CONNECTION_STRING_PROD
      : process.env.STORAGE_CONNECTION_STRING_DEV;

  const connectionString = override ?? process.env.STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error(
      `No storage connection string for '${environment}'. Set STORAGE_CONNECTION_STRING ` +
        `(or STORAGE_CONNECTION_STRING_${environment.toUpperCase()}).`,
    );
  }

  return connectionString;
}

/**
 * Clients are memoized per connection string and pinned to `globalThis` in
 * development, for the same reason the SQL pool is: `next dev` re-evaluates
 * modules on every save, and a fresh client per reload leaks its keep-alive
 * agent.
 */
const globalForBlob = globalThis as typeof globalThis & {
  __blobClients?: Map<string, BlobServiceClient>;
};

function blobService(connectionString: string): BlobServiceClient {
  const cache = globalForBlob.__blobClients ?? new Map<string, BlobServiceClient>();

  let client = cache.get(connectionString);
  if (!client) {
    client = BlobServiceClient.fromConnectionString(connectionString);
    cache.set(connectionString, client);
  }

  if (process.env.NODE_ENV !== "production") {
    globalForBlob.__blobClients = cache;
  }

  return client;
}

export interface ManifestBlobRead {
  /** False when the blob does not exist — an alarm, not an empty manifest. */
  found: boolean;
  /** Raw document text; null when not found. */
  text: string | null;
  /** `deployments/deployed.prod.json`, for error messages. */
  source: string;
}

/**
 * Fetch the manifest document.
 *
 * Distinguishes "the blob is absent" from "the blob holds `{}`". The platform's
 * deploy pipelines upload on every deploy, so an absent blob means that step
 * never ran — which must not be reported as an idle environment.
 *
 * Throws on transport or authorization failures; the caller decides how to
 * surface those. It deliberately does not swallow them into `found: false`,
 * because "I could not reach storage" and "the pipeline did not upload" call
 * for different responses.
 */
export async function readManifestBlob(
  environment: DeploymentEnv,
): Promise<ManifestBlobRead> {
  const blobName = deployedBlobName(environment);
  const source = `${DEPLOYED_CONTAINER}/${blobName}`;

  const blob = blobService(resolveStorageConnectionString(environment))
    .getContainerClient(DEPLOYED_CONTAINER)
    .getBlockBlobClient(blobName);

  if (!(await blob.exists())) {
    return { found: false, text: null, source };
  }

  const buffer = await blob.downloadToBuffer();
  return { found: true, text: buffer.toString("utf8"), source };
}

"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

/**
 * Browser-side auth client. No baseURL — same-origin requests to
 * /api/auth/*, which keeps the canonical hostname out of the client bundle.
 * NEXT_PUBLIC_ vars are inlined at build time and the promote pipeline ships one
 * image to both dev and prod, so a baked origin would be wrong in one of them.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { signIn, signOut, useSession } = authClient;

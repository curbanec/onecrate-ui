"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";

import { auth } from "@/lib/auth";

export interface LoginState {
  errors?: { email?: string; password?: string };
  message?: string;
}

/**
 * Sign in. Runs only on the server, so the credential check never reaches the
 * client. The `nextCookies()` plugin lifts Better Auth's Set-Cookie onto the
 * action's response — a Server Component could not set it itself.
 */
export async function login(
  _state: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/fleet");

  const errors: LoginState["errors"] = {};
  if (!email) errors.email = "Required.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Not a valid email.";
  if (!password) errors.password = "Required.";
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      // Deliberately not distinguishing unknown-email from wrong-password —
      // that difference tells an attacker which addresses are real accounts.
      return { message: "Those credentials did not match." };
    }
    throw error;
  }

  // Only ever an internal path; an absolute URL here would be an open redirect.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/fleet");
}

export async function logout() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

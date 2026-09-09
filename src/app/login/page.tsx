import type { Metadata } from "next";

import { Wordmark } from "@/components/shell/wordmark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · OneCrate",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const raw = params.next;
  const candidate = Array.isArray(raw) ? raw[0] : raw;

  const next =
    candidate && candidate.startsWith("/") && !candidate.startsWith("//")
      ? candidate
      : "/fleet";

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <div className="w-[352px]">
        <div className="mb-6 flex justify-center">
          <Wordmark cubeWidth={26} cubeHeight={30} />
        </div>

        <div className="rounded-card border border-frame bg-panel p-4">
          <LoginForm next={next} />
        </div>

        <p className="text-note text-muted mt-3 text-center">
          accounts are provisioned · no public signup
        </p>
      </div>
    </main>
  );
}

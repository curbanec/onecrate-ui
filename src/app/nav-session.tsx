import Link from "next/link";

import { optionalSession } from "@/lib/dal";

export async function NavSession() {
  const session = await optionalSession();

  return (
    <Link
      href={session ? "/fleet" : "/login"}
      className="text-data text-accent decoration-accent-line underline underline-offset-4 hover:decoration-accent"
    >
      {session ? "Open Fleet →" : "Sign in →"}
    </Link>
  );
}

export function NavSessionFallback() {
  return <span className="text-data text-flat">—</span>;
}

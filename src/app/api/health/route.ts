import { NextResponse } from "next/server";

/**
 * Liveness probe for Container Apps ingress.
 *
 * Deliberately does not touch the database. A probe that fails when SQL is
 * briefly unreachable makes the platform kill and restart replicas during a
 * transient database blip, turning a degraded read path into an outage.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}

"use client";

import { useEffect, useState } from "react";

const GRID_DIVISIONS = 3;
const SPIN_MS = 1200;

/** True isometric: 45° about the vertical axis, then tilted by atan(1/√2). */
const BASE_YAW = Math.PI / 4;
const TILT = Math.atan(1 / Math.SQRT2);

/** Fits the projection to the logo's 0 0 26 30 viewBox. */
const SCALE = 13 / Math.SQRT2;
const CX = 13;
const CY = 15;

type Vec = [number, number, number];

interface Face {
  normal: Vec;
  /** u × v = normal, so from outside u reads right and v reads up. */
  u: Vec;
  v: Vec;
}

const FACES: Face[] = [
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

function rotate([x, y, z]: Vec, yaw: number): Vec {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  return [
    x1,
    y * Math.cos(TILT) - z1 * Math.sin(TILT),
    y * Math.sin(TILT) + z1 * Math.cos(TILT),
  ];
}

function project(p: Vec, yaw: number): [number, number] {
  const [x, y] = rotate(p, yaw);
  return [round(CX + SCALE * x), round(CY - SCALE * y)];
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

function point({ normal: n, u, v }: Face, a: number, b: number): Vec {
  return [n[0] + a * u[0] + b * v[0], n[1] + a * u[1] + b * v[1], n[2] + a * u[2] + b * v[2]];
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function GridCube({ spin = false }: { spin?: boolean }) {
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    if (!spin || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SPIN_MS);
      setTurn(easeInOutCubic(t) * 2 * Math.PI);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spin]);

  const yaw = BASE_YAW + turn;
  const steps = Array.from(
    { length: GRID_DIVISIONS - 1 },
    (_, i) => -1 + (2 * (i + 1)) / GRID_DIVISIONS,
  );

  const visible = FACES.filter((face) => rotate(face.normal, yaw)[2] > 1e-6);

  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {visible.map((face) => (
        <g key={face.normal.join()}>
          <g fill="none" stroke="var(--accent)" strokeOpacity={0.55} strokeWidth={0.5}>
            {steps.flatMap((s) => [
              [point(face, s, -1), point(face, s, 1)],
              [point(face, -1, s), point(face, 1, s)],
            ]).map(([from, to], i) => {
              const [x1, y1] = project(from, yaw);
              const [x2, y2] = project(to, yaw);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </g>
          <polygon
            fill="none"
            stroke="var(--accent-ink)"
            strokeWidth={0.9}
            points={[
              point(face, -1, -1),
              point(face, 1, -1),
              point(face, 1, 1),
              point(face, -1, 1),
            ]
              .map((p) => project(p, yaw).join(","))
              .join(" ")}
          />
        </g>
      ))}
    </g>
  );
}

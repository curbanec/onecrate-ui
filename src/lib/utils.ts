import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The type scale from DESIGN_SYSTEM.md §3.1. These names have to be declared
 * here because tailwind-merge cannot tell a custom font-size from a custom
 * color — both render as `text-*`. Unconfigured, it files `text-data` under
 * text-color, where it collides with `text-ink` and one of the two is silently
 * dropped, so every figure loses either its size or its color.
 *
 * Keep in sync with the `--text-*` tokens in globals.css.
 */
const FONT_SIZES = [
  "heading",
  "data-lg",
  "data",
  "data-sm",
  "label",
  "body",
  "note",
];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: FONT_SIZES }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

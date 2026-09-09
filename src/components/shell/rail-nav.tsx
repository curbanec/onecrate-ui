import Link from "next/link";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/lib/fleet";

export function RailNav({ active }: { active: NavItem }) {
  return (
    <nav className="flex flex-col gap-0.5 p-[10px_8px]">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item}
          href={item === "Fleet" ? "/" : `/${item.toLowerCase()}`}
          aria-current={item === active ? "page" : undefined}
          className={cn(
            "rounded-control text-note px-[10px] py-2 leading-[1.2] font-medium no-underline",
            item === active
              ? "bg-accent-surface text-accent-ink"
              : "text-muted hover:bg-accent-surface/40",
          )}
        >
          {item}
        </Link>
      ))}
    </nav>
  );
}

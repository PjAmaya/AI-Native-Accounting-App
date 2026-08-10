"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FileMinus,
  Receipt,
  Wallet,
  Users,
  BookOpen,
  Lock,
  BarChart3,
  Settings,
} from "lucide-react";

type Item = { href: string; label: string; icon: typeof FileText };
type Group = { heading: string | null; items: Item[] };

const NAV: Group[] = [
  {
    heading: null,
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Receivable",
    items: [
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/credit-notes", label: "Credit notes", icon: FileMinus },
    ],
  },
  {
    heading: "Payable",
    items: [{ href: "/bills", label: "Bills", icon: Receipt }],
  },
  {
    heading: null,
    items: [
      { href: "/payments", label: "Payments", icon: Wallet },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    heading: "Setup",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/accounts", label: "Accounts", icon: BookOpen },
      { href: "/periods", label: "Periods", icon: Lock },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col overflow-y-auto bg-ink text-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Image
          src="/logo.png"
          alt=""
          width={32}
          height={32}
          className="rounded-md bg-white/95"
        />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">Story Craft</div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-white/45">Books</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-3 pb-4">
        {NAV.map((group, groupIndex) => (
          <div key={group.heading ?? `group-${groupIndex}`}>
            {group.heading ? (
              <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                {group.heading}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors " +
                        (active
                          ? "bg-brand text-white font-medium"
                          : "text-white/65 hover:bg-white/8 hover:text-white")
                      }
                    >
                      <Icon size={15} strokeWidth={1.75} aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto px-5 py-4 text-[10px] uppercase tracking-[0.12em] text-white/30">
        FY 2026
      </div>
    </nav>
  );
}

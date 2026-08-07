"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, FileMinus, Receipt, Wallet, Users, BookOpen, BarChart3, Settings } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/credit-notes", label: "Credit notes", icon: FileMinus },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/accounts", label: "Accounts", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col bg-ink text-white">
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

      <ul className="mt-2 flex flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
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

      <div className="mt-auto px-5 py-4 text-[10px] uppercase tracking-[0.12em] text-white/30">
        FY 2026
      </div>
    </nav>
  );
}

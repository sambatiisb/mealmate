"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/home", label: "Home", letter: "H" },
  { href: "/app/menu", label: "Menu", letter: "M" },
  { href: "/app/groceries", label: "Groceries", letter: "G" },
  { href: "/app/profile", label: "Profile", letter: "P" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="app-nav">
      <div className="app-nav-brand">
        <div className="app-nav-brand-mark">Q</div>
        <div className="app-nav-brand-text">MealMate</div>
      </div>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="app-nav-item"
          aria-current={pathname.startsWith(tab.href) ? "page" : undefined}
        >
          <span className="app-nav-icon">{tab.letter}</span>
          <span className="app-nav-label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePosStore } from "@/store/posStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { setPartyModalOpen } = usePosStore();
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        router.push("/billing");
      } else if (e.key === "F3") {
        e.preventDefault();
        if (pathname === "/billing") {
          setPartyModalOpen(true);
        } else {
          router.push("/parties");
        }
      } else if (e.key === "F4") {
        e.preventDefault();
        router.push("/purchases");
      } else if (e.key === "F7") {
        e.preventDefault();
        router.push("/vouchers");
      } else if (e.key === "Escape") {
        setPartyModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, pathname, setPartyModalOpen]);

  const navItems = [
    { href: "/billing", label: "POS Counter", shortcut: "F2" },
    { href: "/purchases", label: "Purchases", shortcut: "F4" },
    { href: "/vouchers", label: "Vouchers", shortcut: "F7" },
    { href: "/parties", label: "Parties", shortcut: "F3" },
    { href: "/inventory", label: "Inventory", shortcut: "" },
    { href: "/ledgers", label: "Audit Trail", shortcut: "" },
    { href: "/reports", label: "Analytics", shortcut: "" },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F9FAFB] text-zinc-900">
      {/* MINIMAL CLEAN TOPBAR (h-14) */}
      <header className="h-14 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shrink-0 select-none">
        {/* Left: Bold clean monospace logo: ERP */}
        <div className="flex items-center space-x-3">
          <Link
            href="/billing"
            className="font-mono font-bold text-base tracking-wider text-zinc-900 hover:text-zinc-700 transition-colors"
          >
            ERP
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-xs text-zinc-500 font-medium">Trade Management</span>
        </div>

        {/* Center: Clean Nav tabs */}
        <nav className="flex items-center space-x-1 bg-zinc-100 p-1 rounded-md border border-zinc-200/80">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white text-zinc-950 font-semibold shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
                }`}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="text-[10px] font-mono text-zinc-400">
                    [{item.shortcut}]
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: System status */}
        <div className="flex items-center space-x-3 text-xs text-zinc-600">
          <div className="flex items-center space-x-1.5 font-mono text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="text-zinc-700 font-medium">Database Online</span>
          </div>
          <span className="text-zinc-300">|</span>
          <div className="font-mono text-zinc-500 text-xs tabular-nums">
            {time || "00:00:00"}
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT CONTAINER */}
      <main className="flex-1 overflow-hidden p-6">
        <div className="max-w-7xl mx-auto h-full">{children}</div>
      </main>
    </div>
  );
}

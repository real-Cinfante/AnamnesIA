"use client";

import Sidebar from "./sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        id="main-content"
        className="flex-1 ml-[240px] min-h-screen"
        style={{ backgroundColor: "var(--cream)" }}
        role="main"
      >
        <div className="px-8 py-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

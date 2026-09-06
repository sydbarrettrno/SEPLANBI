import type { ReactNode } from "react";
import type { PageId } from "../types";
import { Sidebar } from "./Sidebar";

interface DashboardShellProps {
  page: PageId;
  menuOpen: boolean;
  onNavigate: (page: PageId) => void;
  onMenuClose: () => void;
  adminAuthorized: boolean;
  className?: string;
  beforeContent?: ReactNode;
  children: ReactNode;
}

export function DashboardShell({
  page,
  menuOpen,
  onNavigate,
  onMenuClose,
  adminAuthorized,
  className = "",
  beforeContent,
  children,
}: DashboardShellProps) {
  const shellClassName = ["app-shell", className].filter(Boolean).join(" ");

  return (
    <div className={shellClassName}>
      <Sidebar
        page={page}
        onNavigate={onNavigate}
        open={menuOpen}
        onClose={onMenuClose}
        adminAuthorized={adminAuthorized}
      />
      <div className="app-main">
        {beforeContent}
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

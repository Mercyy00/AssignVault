import React from "react";

/**
 * Top-level /admin layout. Intentionally a thin wrapper: it applies to BOTH the
 * public login page and the protected area, so it must NOT run the admin guard.
 *
 * The real authentication/authorization gate lives in the (protected) route
 * group's layout — see app/admin/(protected)/layout.tsx. Route groups let the
 * login page sit outside the guarded subtree without a fragile pathname check.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6">{children}</div>;
}

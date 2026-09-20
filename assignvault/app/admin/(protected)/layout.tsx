import React from "react";
import Link from "next/link";
import { getAdminSession } from "@/lib/security/adminAuth";
import { createAuthClient } from "@/lib/supabase/serverAuth";
import { AdminNav } from "@/components/admin/AdminNav";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Guard for everything under /admin EXCEPT the login page. Because this layout
 * lives in the (protected) route group, the login route (app/admin/login) is
 * not wrapped by it — so no pathname sniffing is needed.
 *
 * The proxy already redirects unauthenticated visitors to /admin/login, but we
 * still verify admin_users membership here server-side (defense in depth) and
 * render a 403 for a signed-in non-admin.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    // Distinguish "signed in but not an admin" (403) from "not signed in".
    const auth = await createAuthClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (user) {
      return (
        <div className="max-w-lg mx-auto py-16 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">403 — Not authorized</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">
            You are signed in as <strong>{user.email}</strong>, but this account is not an
            administrator. Ask an existing admin to grant you access.
          </p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 font-medium underline">
            Return to home
          </Link>
        </div>
      );
    }

    // Not signed in — the proxy normally handles this, but render a prompt as a
    // fallback (e.g. if the proxy matcher is ever bypassed).
    return (
      <div className="max-w-lg mx-auto py-16 text-center px-4">
        <h1 className="text-2xl font-bold mb-2">Admin sign-in required</h1>
        <Link
          href="/admin/login"
          className="text-blue-600 dark:text-blue-400 font-medium underline"
        >
          Go to the login page
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <AdminNav email={session.email} />
      {children}
    </div>
  );
}

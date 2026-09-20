import { NextResponse, type NextRequest } from "next/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";

/**
 * Next 16 Proxy (formerly middleware). Coarse gate for the admin area:
 * - Refreshes the Supabase auth session cookie on every /admin request.
 * - Redirects unauthenticated visitors to /admin/login.
 *
 * NOTE: this is a first line of defense only. The `admin_users` membership
 * check and all real authorization happen server-side in each route handler /
 * server component via requireAdmin() — never trust the proxy alone.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page and the auth callback must stay public.
  const isPublicAdminPath =
    pathname === "/admin/login" || pathname.startsWith("/api/admin/session");

  const response = NextResponse.next({ request });

  const supabase = createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicAdminPath) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on the admin pages and the admin API, but skip the login page assets.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

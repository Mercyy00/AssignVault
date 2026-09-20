import React from "react";
import Link from "next/link";
import { FileCode2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-sm">
          <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">
            <FileCode2 className="w-3.5 h-3.5" />
          </div>
          <span>
            Assign<strong className="text-zinc-900 dark:text-white">Vault</strong> &copy;{" "}
            {new Date().getFullYear()} · 3rd Year BCS Assignment Hub
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/about"
            className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2"
          >
            About
          </Link>
          <Link
            href="/terms"
            className="text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2"
          >
            Terms of Use
          </Link>
          <Link
            href="/admin"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs py-2 transition-colors"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}

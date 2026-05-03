import Link from "next/link";
import {
  BookOpen,
  LayoutDashboard,
  LogIn,
  LogOut,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { getSessionProfile } from "@/lib/auth";

export async function SiteHeader() {
  let session: Awaited<ReturnType<typeof getSessionProfile>> | null = null;

  try {
    session = await getSessionProfile();
  } catch {
    session = null;
  }

  const isAdmin = session?.profile?.role === "admin";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-lg font-bold text-slate-950"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          Академія
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {isAdmin ? (
            <Link className="btn-secondary h-10 px-3" href="/lessons/create">
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Створити урок
            </Link>
          ) : null}

          {session?.user ? (
            <>
              <Link className="btn-secondary h-10 px-3" href="/dashboard">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Кабінет
              </Link>
              {isAdmin ? (
                <Link className="btn-secondary h-10 px-3" href="/admin">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Адмін
                </Link>
              ) : null}
              <form action={logoutAction}>
                <button className="btn-secondary h-10 px-3" type="submit">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Вийти
                </button>
              </form>
            </>
          ) : (
            <Link className="btn-primary h-10 px-3" href="/auth/login">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Увійти
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

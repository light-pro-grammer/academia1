"use client";

import { RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="page-shell">
      <div className="panel p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
          Помилка
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Щось пішло не так
        </h1>
        <p className="mt-2 text-sm text-slate-600">{error.message}</p>
        <button className="btn-primary mt-5" onClick={reset} type="button">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Спробувати ще раз
        </button>
      </div>
    </section>
  );
}

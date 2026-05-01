import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page-shell">
      <div className="panel p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Сторінку не знайдено
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
          Можливо, матеріал ще не опубліковано або посилання змінилося.
        </p>
        <Link className="btn-primary mt-5" href="/">
          На головну
        </Link>
      </div>
    </section>
  );
}

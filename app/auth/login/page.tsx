import Link from "next/link";
import { loginAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/submit-button";

type LoginPageProps = {
  searchParams: {
    error?: string;
    message?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <section className="page-shell flex min-h-[calc(100vh-84px)] items-center justify-center">
      <div className="panel w-full max-w-md p-6">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Вхід
          </p>
          <h1 className="text-2xl font-bold text-slate-950">
            Поверніться до навчання
          </h1>
          <p className="text-sm text-slate-600">
            Увійдіть, щоб створювати уроки, бачити прогрес і керувати своїми
            матеріалами.
          </p>
        </div>

        {searchParams.message ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {searchParams.message}
          </div>
        ) : null}

        {searchParams.error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {searchParams.error}
          </div>
        ) : null}

        <form action={loginAction} className="space-y-4">
          <div className="space-y-2">
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              className="field-input"
              id="email"
              name="email"
              placeholder="student@example.com"
              required
              type="email"
            />
          </div>
          <div className="space-y-2">
            <label className="field-label" htmlFor="password">
              Пароль
            </label>
            <input
              className="field-input"
              id="password"
              minLength={6}
              name="password"
              placeholder="Ваш пароль"
              required
              type="password"
            />
          </div>
          <SubmitButton label="Увійти" pendingLabel="Входимо..." />
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Ще немає акаунта?{" "}
          <Link className="font-semibold text-emerald-700" href="/auth/register">
            Зареєструватися
          </Link>
        </p>
      </div>
    </section>
  );
}

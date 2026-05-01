import Link from "next/link";
import { registerAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/auth/submit-button";

type RegisterPageProps = {
  searchParams: {
    error?: string;
  };
};

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  return (
    <section className="page-shell flex min-h-[calc(100vh-84px)] items-center justify-center">
      <div className="panel w-full max-w-md p-6">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Реєстрація
          </p>
          <h1 className="text-2xl font-bold text-slate-950">
            Створіть навчальний акаунт
          </h1>
          <p className="text-sm text-slate-600">
            Після реєстрації ви зможете надсилати уроки на модерацію.
          </p>
        </div>

        {searchParams.error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {searchParams.error}
          </div>
        ) : null}

        <form action={registerAction} className="space-y-4">
          <div className="space-y-2">
            <label className="field-label" htmlFor="username">
              Ім&apos;я користувача
            </label>
            <input
              className="field-input"
              id="username"
              name="username"
              placeholder="Наприклад, oksana_math"
              required
            />
          </div>
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
              placeholder="Мінімум 6 символів"
              required
              type="password"
            />
          </div>
          <SubmitButton label="Зареєструватися" pendingLabel="Створюємо..." />
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Уже маєте акаунт?{" "}
          <Link className="font-semibold text-emerald-700" href="/auth/login">
            Увійти
          </Link>
        </p>
      </div>
    </section>
  );
}

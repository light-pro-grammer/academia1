import { CreateLessonForm } from "@/components/lessons/create-lesson-form";
import { requireAdmin } from "@/lib/auth";
import type { Course, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

type CreateLessonPageProps = {
  searchParams: {
    error?: string;
  };
};

export default async function CreateLessonPage({
  searchParams,
}: CreateLessonPageProps) {
  const { supabase } = await requireAdmin();
  const [{ data: subjects, error }, { data: courses }] = await Promise.all([
    supabase.from("subjects").select("*").order("title", { ascending: true }),
    supabase
      .from("courses")
      .select("*")
      .order("order_index", { ascending: true }),
  ]);

  const subjectList = (subjects ?? []) as Subject[];
  const courseList = (courses ?? []) as Course[];

  return (
    <section className="page-shell space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Новий урок
        </p>
        <h1 className="text-3xl font-bold text-slate-950">
          Створити навчальний матеріал
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Пишіть у Markdown і одразу перевіряйте, як виглядатимуть формули,
          код, відео та зображення.
        </p>
      </div>

      {searchParams.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {searchParams.error}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Не вдалося завантажити предмети: {error.message}
        </div>
      ) : null}

      {subjectList.length > 0 ? (
        <CreateLessonForm
          adminHint
          courses={courseList}
          helperText="Урок буде одразу опубліковано."
          pendingLabel="Публікуємо..."
          subjects={subjectList}
          submitLabel="Опублікувати урок"
        />
      ) : (
        <div className="panel p-6 text-sm text-slate-600">
          Спочатку додайте предмети в Supabase.
        </div>
      )}
    </section>
  );
}

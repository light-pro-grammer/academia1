import { notFound } from "next/navigation";
import { updateLessonAction } from "@/app/lessons/[slug]/edit/actions";
import { CreateLessonForm } from "@/components/lessons/create-lesson-form";
import { requireAdmin } from "@/lib/auth";
import type { Course, Lesson, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

type EditLessonPageProps = {
  params: {
    slug: string;
  };
  searchParams: {
    error?: string;
  };
};

export default async function EditLessonPage({
  params,
  searchParams,
}: EditLessonPageProps) {
  const { supabase } = await requireAdmin();
  const [
    { data: lesson, error: lessonError },
    { data: subjects, error: subjectsError },
    { data: courses },
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select("*")
      .eq("slug", params.slug)
      .maybeSingle<Lesson>(),
    supabase.from("subjects").select("*").order("title", { ascending: true }),
    supabase
      .from("courses")
      .select("*")
      .order("order_index", { ascending: true }),
  ]);

  if (lessonError || !lesson) {
    notFound();
  }

  const subjectList = (subjects ?? []) as Subject[];
  const courseList = (courses ?? []) as Course[];

  return (
    <section className="page-shell space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Редагування уроку
        </p>
        <h1 className="text-3xl font-bold text-slate-950">
          Оновити навчальний матеріал
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Змініть назву, курс або зміст уроку. Після збереження урок залишиться
          опублікованим.
        </p>
      </div>

      {searchParams.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {searchParams.error}
        </div>
      ) : null}

      {subjectsError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Не вдалося завантажити предмети: {subjectsError.message}
        </div>
      ) : null}

      {subjectList.length > 0 ? (
        <CreateLessonForm
          adminHint
          courses={courseList}
          formAction={updateLessonAction}
          helperText="Після збереження урок залишиться опублікованим."
          initialLesson={lesson}
          pendingLabel="Зберігаємо..."
          subjects={subjectList}
          submitLabel="Зберегти зміни"
        />
      ) : (
        <div className="panel p-6 text-sm text-slate-600">
          Спочатку додайте предмети в Supabase.
        </div>
      )}
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, LogIn, Pencil } from "lucide-react";
import { LessonExercises } from "@/components/lessons/lesson-exercises";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { coerceKeywordGroups, type LessonExercise } from "@/lib/exercises";
import { createClient } from "@/lib/supabase/server";
import type { Lesson, Profile, Progress, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

type LessonPageProps = {
  params: {
    slug: string;
  };
  searchParams: {
    error?: string;
    message?: string;
  };
};

type LessonDetails = Lesson & {
  subjects?: Pick<Subject, "title" | "slug"> | null;
};

export default async function LessonPage({
  params,
  searchParams,
}: LessonPageProps) {
  const supabase = createClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*, subjects(title, slug)")
    .eq("slug", params.slug)
    .eq("status", "approved")
    .maybeSingle<LessonDetails>();

  if (error || !lesson) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let progress: Progress | null = null;
  let viewerProfile: Pick<Profile, "role"> | null = null;

  if (user) {
    const [{ data }, { data: profileData }] = await Promise.all([
      supabase
        .from("progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("lesson_id", lesson.id)
        .maybeSingle<Progress>(),
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<Pick<Profile, "role">>(),
    ]);

    progress = data ?? null;
    viewerProfile = profileData ?? null;
  }

  const isCompleted = Boolean(progress?.completed);
  const canEdit = viewerProfile?.role === "admin";
  const { data: exerciseData, error: exercisesError } = await supabase
    .from("lesson_exercises")
    .select("*")
    .eq("lesson_id", lesson.id)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });
  const exercises = exercisesError
    ? []
    : ((exerciseData ?? []) as LessonExercise[]).map((exercise) => ({
        ...exercise,
        required_keywords: coerceKeywordGroups(exercise.required_keywords),
      }));

  return (
    <section className="page-shell space-y-6">
      <div className="panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              href={`/subjects/${lesson.subjects?.slug ?? ""}`}
            >
              {lesson.subjects?.title ?? "Предмет"}
            </Link>
            <h1 className="max-w-4xl text-3xl font-bold text-slate-950 sm:text-4xl">
              {lesson.title}
            </h1>
          </div>

          <div className="w-full space-y-3 lg:w-64">
            {canEdit ? (
              <Link
                className="btn-secondary w-full"
                href={`/lessons/${lesson.slug}/edit`}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Редагувати
              </Link>
            ) : null}

            {user ? (
              isCompleted ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                  Урок завершено
                </div>
              ) : exercises.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  Пройдіть вправи мінімум на 70%, щоб завершити урок.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Вправи ще не додані.
                </div>
              )
            ) : (
              <Link className="btn-secondary w-full" href="/auth/login">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Увійти для прогресу
              </Link>
            )}
          </div>
        </div>
      </div>

      {searchParams.message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {searchParams.message}
        </div>
      ) : null}

      {searchParams.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {searchParams.error}
        </div>
      ) : null}

      <div className="panel p-5 sm:p-8">
        <MarkdownRenderer content={lesson.content} />
      </div>

      <LessonExercises
        canManageExercises={canEdit}
        exercises={exercises}
        isCompleted={isCompleted}
        isLoggedIn={Boolean(user)}
        lessonId={lesson.id}
        lessonSlug={lesson.slug}
        loadError={
          exercisesError
            ? "Не вдалося завантажити вправи. Перевірте, чи виконана SQL-міграція для інтерактивних вправ."
            : undefined
        }
      />
    </section>
  );
}

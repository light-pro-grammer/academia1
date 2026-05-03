import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, LogIn, Pencil, UserRound } from "lucide-react";
import { markLessonCompletedAction } from "@/app/lessons/[slug]/actions";
import { MarkdownRenderer } from "@/components/markdown-renderer";
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
  profiles?: Pick<Profile, "username"> | null;
};

export default async function LessonPage({
  params,
  searchParams,
}: LessonPageProps) {
  const supabase = createClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*, subjects(title, slug), profiles(username)")
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
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                {lesson.profiles?.username ?? "Автор"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {new Intl.DateTimeFormat("uk-UA").format(
                  new Date(lesson.created_at),
                )}
              </span>
            </div>
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
              ) : (
                <form action={markLessonCompletedAction}>
                  <input name="lesson_id" type="hidden" value={lesson.id} />
                  <input name="lesson_slug" type="hidden" value={lesson.slug} />
                  <button className="btn-primary w-full" type="submit">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Позначити завершеним
                  </button>
                </form>
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
    </section>
  );
}

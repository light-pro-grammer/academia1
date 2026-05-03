import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  PlusCircle,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import type { Lesson, Progress, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: {
    error?: string;
    message?: string;
  };
};

type SubmittedLesson = Lesson & {
  subjects?: Pick<Subject, "title" | "slug"> | null;
};

type ProgressItem = Progress & {
  lessons?:
    | (Pick<Lesson, "id" | "title" | "slug" | "subject_id"> & {
        subjects?: Pick<Subject, "title" | "slug"> | null;
      })
    | null;
};

function StatusBadge({ status }: { status: Lesson["status"] }) {
  const labels = {
    pending: "На модерації",
    approved: "Затверджено",
    rejected: "Відхилено",
  };

  const classes = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
  };

  return <span className={`status-pill ${classes[status]}`}>{labels[status]}</span>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { supabase, user, profile } = await requireUser();

  const [
    { data: submittedLessonsData, error: lessonsError },
    { data: progressData, error: progressError },
    { data: subjectsData },
    { data: approvedLessonsData },
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select("*, subjects(title, slug)")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("progress")
      .select("*, lessons(id, title, slug, subject_id, subjects(title, slug))")
      .eq("user_id", user.id)
      .eq("completed", true)
      .order("completed_at", { ascending: false }),
    supabase.from("subjects").select("*").order("title", { ascending: true }),
    supabase
      .from("lessons")
      .select("id, subject_id")
      .eq("status", "approved"),
  ]);

  const submittedLessons = (submittedLessonsData ?? []) as SubmittedLesson[];
  const completedLessons = (progressData ?? []) as ProgressItem[];
  const subjects = (subjectsData ?? []) as Subject[];
  const approvedLessons = (approvedLessonsData ?? []) as Pick<
    Lesson,
    "id" | "subject_id"
  >[];
  const completedLessonIds = new Set(
    completedLessons.map((item) => item.lesson_id),
  );
  const isAdmin = profile?.role === "admin";

  const subjectProgress = subjects.map((subject) => {
    const total = approvedLessons.filter(
      (lesson) => lesson.subject_id === subject.id,
    ).length;
    const completed = approvedLessons.filter(
      (lesson) =>
        lesson.subject_id === subject.id && completedLessonIds.has(lesson.id),
    ).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { subject, total, completed, percent };
  });

  return (
    <section className="page-shell space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Кабінет
          </p>
          <h1 className="text-3xl font-bold text-slate-950">
            Вітаємо, {profile?.username ?? user.email}
          </h1>
          <p className="text-sm text-slate-600">
            Тут зібрані ваші уроки та прогрес за предметами.
          </p>
        </div>
        {isAdmin ? (
          <Link className="btn-primary" href="/lessons/create">
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Створити урок
          </Link>
        ) : null}
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <p className="text-sm text-slate-600">Завершено уроків</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {completedLessons.length}
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-slate-600">Надіслано уроків</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {submittedLessons.length}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-slate-950">
            Прогрес за предметами
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {subjectProgress.map(({ subject, total, completed, percent }) => (
            <Link
              className="panel p-5 transition hover:border-emerald-300 hover:shadow-md"
              href={`/subjects/${subject.slug}`}
              key={subject.id}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-950">{subject.title}</h3>
                <span className="text-sm font-semibold text-slate-600">
                  {completed} з {total} уроків завершено
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-600">{percent}%</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-950">Мої уроки</h2>

        {lessonsError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Не вдалося завантажити уроки: {lessonsError.message}
          </div>
        ) : null}

        {submittedLessons.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {submittedLessons.map((lesson) => (
              <article className="panel p-5" key={lesson.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {lesson.subjects?.title ?? "Предмет"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Intl.DateTimeFormat("uk-UA").format(
                          new Date(lesson.created_at),
                        )}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-950">
                      {lesson.title}
                    </h3>
                    {lesson.status === "rejected" && lesson.rejection_reason ? (
                      <p className="mt-2 text-sm text-rose-700">
                        Причина: {lesson.rejection_reason}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={lesson.status} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-sm text-slate-600">
            Ви ще не створили жодного уроку.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-950">Завершені уроки</h2>

        {progressError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Не вдалося завантажити прогрес: {progressError.message}
          </div>
        ) : null}

        {completedLessons.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {completedLessons.map((item) => (
              <Link
                className="panel block p-5 transition hover:border-emerald-300 hover:shadow-md"
                href={`/lessons/${item.lessons?.slug ?? ""}`}
                key={item.id}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div>
                    <h3 className="font-bold text-slate-950">
                      {item.lessons?.title ?? "Урок"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.lessons?.subjects?.title ?? "Предмет"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-sm text-slate-600">
            Завершені уроки з&apos;являться тут.
          </div>
        )}
      </section>
    </section>
  );
}

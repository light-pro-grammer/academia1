import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Layers3,
} from "lucide-react";
import { SubjectIcon } from "@/components/subject-icon";
import { createClient } from "@/lib/supabase/server";
import type { Course, Exam, Lesson, Progress, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

type SubjectPageProps = {
  params: {
    slug: string;
  };
};

type CourseWithLessons = Course & {
  lessons?: Pick<Lesson, "id" | "status">[] | null;
};

export default async function SubjectPage({ params }: SubjectPageProps) {
  const supabase = createClient();
  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle<Subject>();

  if (subjectError || !subject) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: courses, error: coursesError },
    { data: exam },
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("*, lessons(id, status)")
      .eq("subject_id", subject.id)
      .order("order_index", { ascending: true }),
    supabase
      .from("exams")
      .select("*")
      .eq("subject_id", subject.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Exam>(),
  ]);

  const courseList = (courses ?? []) as unknown as CourseWithLessons[];
  const approvedLessonIds = courseList.flatMap((course) =>
    (course.lessons ?? [])
      .filter((lesson) => lesson.status === "approved")
      .map((lesson) => lesson.id),
  );

  const { data: progress } =
    user && approvedLessonIds.length > 0
      ? await supabase
          .from("progress")
          .select("*")
          .eq("user_id", user.id)
          .in("lesson_id", approvedLessonIds)
          .eq("completed", true)
      : { data: [] as Progress[] };

  const completedLessonIds = new Set(
    ((progress ?? []) as Progress[]).map((item) => item.lesson_id),
  );

  return (
    <section className="page-shell space-y-6">
      <div className="panel p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <SubjectIcon name={subject.icon} className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Предмет
            </p>
            <h1 className="text-3xl font-bold text-slate-950">
              {subject.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {subject.description}
            </p>
          </div>
        </div>
      </div>

      {coursesError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Не вдалося завантажити курси: {coursesError.message}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-950">Курси</h2>
          <span className="status-pill bg-slate-100 text-slate-700">
            {courseList.length} курсів
          </span>
        </div>

        {courseList.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {courseList.map((course) => {
              const approvedLessons = (course.lessons ?? []).filter(
                (lesson) => lesson.status === "approved",
              );
              const completedCount = approvedLessons.filter((lesson) =>
                completedLessonIds.has(lesson.id),
              ).length;
              const progressPercent =
                approvedLessons.length > 0
                  ? Math.round((completedCount / approvedLessons.length) * 100)
                  : 0;

              return (
                <Link
                  className="panel group p-5 transition hover:border-emerald-300 hover:shadow-md"
                  href={`/subjects/${subject.slug}/courses/${course.slug}`}
                  key={course.id}
                >
                  <div className="flex h-full flex-col justify-between gap-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                          <Layers3 className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                          {approvedLessons.length} уроків
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-950">
                          {course.title}
                        </h3>
                        {course.description ? (
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                            {course.description}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {user ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                            <span>
                              {completedCount} з {approvedLessons.length} уроків
                              завершено
                            </span>
                            {completedCount === approvedLessons.length &&
                            approvedLessons.length > 0 ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                            ) : (
                              <span>{progressPercent}%</span>
                            )}
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-600"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : null}

                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                        Відкрити курс
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="panel p-6 text-center text-sm text-slate-600">
            У цьому предметі ще немає курсів.
          </div>
        )}
      </div>

      {exam ? (
        <div className="panel p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <GraduationCap className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Підсумковий іспит
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {exam.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {exam.description}
                </p>
              </div>
            </div>
            <Link className="btn-primary" href={`/subjects/${subject.slug}/exam`}>
              Перейти до іспиту
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

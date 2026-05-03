import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Layers3,
} from "lucide-react";
import { LessonOrderingList } from "@/components/admin/lesson-ordering-list";
import { createClient } from "@/lib/supabase/server";
import type { Course, Lesson, Profile, Progress, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

type CoursePageProps = {
  params: {
    slug: string;
    courseSlug: string;
  };
};

type CourseWithSubject = Course & {
  subjects?: Pick<Subject, "title" | "slug"> | null;
};

type LessonWithSubject = Lesson & {
  subjects?: Pick<Subject, "title" | "slug"> | null;
};

export default async function CoursePage({ params }: CoursePageProps) {
  const supabase = createClient();
  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle<Subject>();

  if (subjectError || !subject) {
    notFound();
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*, subjects(title, slug)")
    .eq("subject_id", subject.id)
    .eq("slug", params.courseSlug)
    .maybeSingle<CourseWithSubject>();

  if (courseError || !course) {
    notFound();
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("*, subjects(title, slug)")
    .eq("course_id", course.id)
    .eq("status", "approved")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  const approvedLessons = (lessons ?? []) as LessonWithSubject[];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: viewerProfile } = user
    ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<Pick<Profile, "role">>()
    : { data: null };
  const isAdmin = viewerProfile?.role === "admin";

  const { data: progress } =
    user && approvedLessons.length > 0
      ? await supabase
          .from("progress")
          .select("*")
          .eq("user_id", user.id)
          .in(
            "lesson_id",
            approvedLessons.map((lesson) => lesson.id),
          )
          .eq("completed", true)
      : { data: [] as Progress[] };

  const completedLessonIds = new Set(
    ((progress ?? []) as Progress[]).map((item) => item.lesson_id),
  );

  return (
    <section className="page-shell space-y-6">
      <div className="panel p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Layers3 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <Link
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                href={`/subjects/${subject.slug}`}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {subject.title}
              </Link>
              <h1 className="text-3xl font-bold text-slate-950">
                {course.title}
              </h1>
              {course.description ? (
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  {course.description}
                </p>
              ) : null}
            </div>
          </div>
          <span className="status-pill bg-slate-100 text-slate-700">
            {approvedLessons.length} уроків
          </span>
        </div>
      </div>

      {lessonsError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Не вдалося завантажити уроки: {lessonsError.message}
        </div>
      ) : null}

      {isAdmin && approvedLessons.length > 0 ? (
        <LessonOrderingList
          groups={[
            {
              courseId: course.id,
              courseTitle: course.title,
              orderOffset: 0,
              subjectTitle: subject.title,
              lessons: approvedLessons.map((lesson) => ({
                id: lesson.id,
                title: lesson.title,
                slug: lesson.slug,
                order_index: lesson.order_index,
              })),
            },
          ]}
        />
      ) : approvedLessons.length > 0 ? (
        <div className="grid gap-4">
          {approvedLessons.map((lesson, index) => (
            <Link
              className="panel group p-5 transition hover:border-emerald-300 hover:shadow-md"
              href={`/lessons/${lesson.slug}`}
              key={lesson.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      Урок {index + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-950">
                    {lesson.title}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  {completedLessonIds.has(lesson.id) ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Завершено
                    </>
                  ) : (
                    <>
                      Відкрити
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel p-6 text-center text-sm text-slate-600">
          У цьому курсі ще немає затверджених уроків.
        </div>
      )}
    </section>
  );
}

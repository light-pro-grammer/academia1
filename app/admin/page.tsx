import Link from "next/link";
import { FileText, ListChecks, Pencil, Trash2 } from "lucide-react";
import {
  createCourseAction,
  deleteCourseAction,
  deleteLessonAction,
  updateCourseAction,
} from "@/app/admin/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { requireAdmin } from "@/lib/auth";
import type { Lesson, Course, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: {
    approvedPage?: string;
    error?: string;
    message?: string;
    tab?: string;
  };
};

type LessonOption = Pick<
  Lesson,
  "id" | "title" | "slug" | "subject_id" | "course_id" | "order_index"
> & {
  subjects?: Pick<Subject, "title"> | null;
  courses?:
    | (Pick<Course, "id" | "title" | "slug"> & {
        subjects?: Pick<Subject, "title" | "slug"> | null;
      })
    | null;
};

type CourseWithSubject = Course & {
  subjects?: Pick<Subject, "title" | "slug"> | null;
  lessons?: Pick<Lesson, "id">[] | null;
};

function TabLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-emerald-700 text-white"
          : "bg-white text-slate-700 hover:bg-slate-50"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}

function DeleteButton({ label = "Видалити" }: { label?: string }) {
  return (
    <button className="btn-danger w-full" type="submit">
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function parsePositivePage(value?: string) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function PaginationControls({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pageHref = (page: number) => `/admin?tab=lessons&approvedPage=${page}`;
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <nav
      aria-label="Пагінація уроків"
      className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm font-semibold text-slate-600">
        Сторінка {currentPage} з {totalPages}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          aria-disabled={currentPage <= 1}
          className={`btn-secondary h-10 px-3 ${
            currentPage <= 1 ? "pointer-events-none opacity-50" : ""
          }`}
          href={pageHref(previousPage)}
        >
          Назад
        </Link>
        <Link
          aria-disabled={currentPage >= totalPages}
          className={`btn-secondary h-10 px-3 ${
            currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
          }`}
          href={pageHref(nextPage)}
        >
          Далі
        </Link>
      </div>
    </nav>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const activeTab = searchParams.tab === "courses" ? "courses" : "lessons";
  const approvedPageSize = 25;
  const approvedPage = parsePositivePage(searchParams.approvedPage);
  const approvedFrom = (approvedPage - 1) * approvedPageSize;
  const approvedTo = approvedFrom + approvedPageSize - 1;
  const { supabase } = await requireAdmin();

  let lessons: LessonOption[] = [];
  let lessonCount = 0;
  let lessonsError: { message: string } | null = null;
  let subjects: Subject[] = [];
  let courses: CourseWithSubject[] = [];

  if (activeTab === "lessons") {
    const { data, error, count } = await supabase
      .from("lessons")
      .select(
        "id, title, slug, subject_id, course_id, order_index, courses(id, title, slug, subjects(title, slug)), subjects(title)",
        { count: "exact" },
      )
      .eq("status", "approved")
      .order("course_id", { ascending: true, nullsFirst: false })
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true })
      .range(approvedFrom, approvedTo);

    lessons = (data ?? []) as unknown as LessonOption[];
    lessonCount = count ?? lessons.length;
    lessonsError = error;
  }

  if (activeTab === "courses") {
    const [subjectsResult, coursesResult] = await Promise.all([
      supabase.from("subjects").select("*").order("title", { ascending: true }),
      supabase
        .from("courses")
        .select("*, subjects(title, slug), lessons(id)")
        .order("order_index", { ascending: true }),
    ]);

    subjects = (subjectsResult.data ?? []) as Subject[];
    courses = (coursesResult.data ?? []) as unknown as CourseWithSubject[];
  }

  const coursesBySubject = subjects.map((subject) => ({
    subject,
    courses: courses.filter((course) => course.subject_id === subject.id),
  }));
  const totalPages = Math.max(1, Math.ceil(lessonCount / approvedPageSize));

  return (
    <section className="page-shell space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Адміністрування
        </p>
        <h1 className="text-3xl font-bold text-slate-950">
          Панель керування платформою
        </h1>
        <p className="text-sm text-slate-600">
          Керуйте опублікованими уроками та курсами.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg bg-slate-100 p-2">
        <TabLink active={activeTab === "lessons"} href="/admin?tab=lessons" label="Уроки" />
        <TabLink active={activeTab === "courses"} href="/admin?tab=courses" label="Курси" />
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

      {activeTab === "lessons" ? (
        <section className="panel p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-slate-950">
              Опубліковані уроки
            </h2>
            <span className="status-pill bg-emerald-100 text-emerald-800">
              {lessonCount} опубліковано
            </span>
          </div>

          {lessonsError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Не вдалося завантажити уроки: {lessonsError.message}
            </div>
          ) : null}

          {lessons.length > 0 ? (
            <>
              <div className="space-y-3">
                {lessons.map((lesson) => (
                  <article
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                    key={lesson.id}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            {lesson.subjects?.title ?? "Предмет"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                            {lesson.courses?.title ?? "Без курсу"}
                          </span>
                          <span>Порядок: {lesson.order_index}</span>
                        </div>
                        <Link
                          className="text-lg font-bold text-slate-950 transition hover:text-emerald-700"
                          href={`/lessons/${lesson.slug}`}
                        >
                          {lesson.title}
                        </Link>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                        <Link
                          className="btn-secondary h-10 px-3"
                          href={`/lessons/${lesson.slug}/edit`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Редагувати
                        </Link>
                        <form action={deleteLessonAction}>
                          <input name="lesson_id" type="hidden" value={lesson.id} />
                          <button className="btn-danger h-10 w-full px-3 sm:w-auto" type="submit">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Видалити
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <PaginationControls currentPage={approvedPage} totalPages={totalPages} />
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-600">
              Опублікованих уроків поки немає.
            </p>
          )}
        </section>
      ) : null}

      {activeTab === "courses" ? (
        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="panel h-fit p-5">
            <div className="mb-4 flex items-center gap-3">
              <ListChecks className="h-5 w-5 text-emerald-700" aria-hidden="true" />
              <h2 className="text-xl font-bold text-slate-950">Новий курс</h2>
            </div>
            <form action={createCourseAction} className="space-y-4">
              <div className="space-y-2">
                <label className="field-label" htmlFor="course-subject">
                  Предмет
                </label>
                <select
                  className="field-input"
                  id="course-subject"
                  name="subject_id"
                  required
                >
                  <option value="">Оберіть предмет</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="course-title">
                  Назва курсу
                </label>
                <input
                  className="field-input"
                  id="course-title"
                  name="title"
                  placeholder="Наприклад, Основи механіки"
                  required
                />
                <p className="text-xs text-slate-500">
                  Slug буде згенеровано автоматично з назви.
                </p>
              </div>
              <SubmitButton label="Створити курс" pendingLabel="Створюємо..." />
            </form>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-950">Усі курси</h2>
            {courses.length > 0 ? (
              coursesBySubject.map(({ subject, courses: subjectCourses }) =>
                subjectCourses.length > 0 ? (
                  <section className="panel p-5" key={subject.id}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-slate-950">
                        {subject.title}
                      </h3>
                      <span className="status-pill bg-slate-100 text-slate-700">
                        {subjectCourses.length} курсів
                      </span>
                    </div>
                    <div className="space-y-3">
                      {subjectCourses.map((course) => {
                        const lessonCount = course.lessons?.length ?? 0;

                        return (
                          <div
                            className="rounded-lg border border-slate-200 p-4"
                            key={course.id}
                          >
                            <form
                              action={updateCourseAction}
                              className="grid gap-3 sm:grid-cols-[1fr_auto]"
                            >
                              <input name="course_id" type="hidden" value={course.id} />
                              <div className="space-y-2">
                                <label
                                  className="field-label"
                                  htmlFor={`course-title-${course.id}`}
                                >
                                  Назва
                                </label>
                                <input
                                  className="field-input"
                                  defaultValue={course.title}
                                  id={`course-title-${course.id}`}
                                  name="title"
                                  required
                                />
                                <p className="text-xs text-slate-500">
                                  /subjects/{subject.slug}/courses/{course.slug} ·{" "}
                                  {lessonCount} уроків
                                </p>
                              </div>
                              <div className="flex items-end">
                                <SubmitButton
                                  label="Зберегти"
                                  pendingLabel="Зберігаємо..."
                                />
                              </div>
                            </form>

                            <form action={deleteCourseAction} className="mt-3 space-y-2">
                              <input name="course_id" type="hidden" value={course.id} />
                              {lessonCount > 0 ? (
                                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                  У цьому курсі є уроки. Якщо видалити курс, вони
                                  залишаться без курсу.
                                </p>
                              ) : null}
                              <DeleteButton label="Видалити курс" />
                            </form>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null,
              )
            ) : (
              <div className="panel p-6 text-sm text-slate-600">
                Курси ще не створені.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}

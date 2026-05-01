import Link from "next/link";
import { Check, Clock, FileText, GraduationCap, ListChecks, Pencil, Trash2, UserRound } from "lucide-react";
import {
  approveLessonAction,
  createCourseAction,
  createExamAction,
  deleteCourseAction,
  deleteExamAction,
  deleteExamQuestionAction,
  rejectLessonAction,
  updateCourseAction,
  updateExamAction,
} from "@/app/admin/actions";
import { LessonOrderingList, type LessonOrderGroup } from "@/components/admin/lesson-ordering-list";
import { QuestionForm } from "@/components/admin/question-form";
import { SubmitButton } from "@/components/auth/submit-button";
import { requireAdmin } from "@/lib/auth";
import type {
  Exam,
  ExamQuestion,
  Lesson,
  Profile,
  Course,
  Subject,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: {
    error?: string;
    message?: string;
    tab?: string;
  };
};

type PendingLesson = Lesson & {
  subjects?: Pick<Subject, "title" | "slug"> | null;
  profiles?: Pick<Profile, "username"> | null;
  courses?: Pick<Course, "title" | "slug"> | null;
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

type ExamWithSubject = Exam & {
  subjects?: Pick<Subject, "title" | "slug"> | null;
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

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const activeTab = ["lessons", "courses", "exams"].includes(searchParams.tab ?? "")
    ? searchParams.tab!
    : "lessons";
  const { supabase } = await requireAdmin();

  const [
    { data: pendingLessonsData, error: pendingError },
    { data: approvedLessonsData },
    { data: subjectsData },
    { data: coursesData },
    { data: examsData },
    { data: examQuestionsData },
  ] = await Promise.all([
    supabase
      .from("lessons")
      .select("*, subjects(title, slug), profiles(username), courses(title, slug)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("lessons")
      .select("id, title, slug, subject_id, course_id, order_index, courses(id, title, slug, subjects(title, slug)), subjects(title)")
      .eq("status", "approved")
      .order("course_id", { ascending: true, nullsFirst: false })
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("subjects").select("*").order("title", { ascending: true }),
    supabase
      .from("courses")
      .select("*, subjects(title, slug), lessons(id)")
      .order("order_index", { ascending: true }),
    supabase
      .from("exams")
      .select("*, subjects(title, slug)")
      .order("created_at", { ascending: false }),
    supabase
      .from("exam_questions")
      .select("*")
      .order("order_index", { ascending: true }),
  ]);

  const pendingLessons = (pendingLessonsData ?? []) as unknown as PendingLesson[];
  const approvedLessons = (approvedLessonsData ?? []) as unknown as LessonOption[];
  const subjects = (subjectsData ?? []) as Subject[];
  const courses = (coursesData ?? []) as unknown as CourseWithSubject[];
  const exams = (examsData ?? []) as unknown as ExamWithSubject[];
  const examQuestions = (examQuestionsData ?? []) as ExamQuestion[];
  const coursesBySubject = subjects.map((subject) => ({
    subject,
    courses: courses.filter((course) => course.subject_id === subject.id),
  }));
  const approvedLessonGroups = courses
    .map<LessonOrderGroup>((course) => ({
      courseId: course.id,
      courseTitle: course.title,
      subjectTitle: course.subjects?.title ?? "Предмет",
      lessons: approvedLessons
        .filter((lesson) => lesson.course_id === course.id)
        .sort(
          (first, second) =>
            first.order_index - second.order_index ||
            first.title.localeCompare(second.title, "uk"),
        )
        .map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          order_index: lesson.order_index,
        })),
    }))
    .filter((group) => group.lessons.length > 0);
  const lessonsWithoutCourse = approvedLessons
    .filter((lesson) => !lesson.course_id)
    .sort(
      (first, second) =>
        first.order_index - second.order_index ||
        first.title.localeCompare(second.title, "uk"),
    );

  if (lessonsWithoutCourse.length > 0) {
    approvedLessonGroups.push({
      courseId: null,
      courseTitle: "Без курсу",
      subjectTitle: "Не прив'язано до курсу",
      lessons: lessonsWithoutCourse.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        order_index: lesson.order_index,
      })),
    });
  }

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
          Модеруйте уроки, керуйте курсами та налаштовуйте іспити.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg bg-slate-100 p-2">
        <TabLink active={activeTab === "lessons"} href="/admin?tab=lessons" label="Уроки" />
        <TabLink active={activeTab === "courses"} href="/admin?tab=courses" label="Курси" />
        <TabLink active={activeTab === "exams"} href="/admin?tab=exams" label="Іспити" />
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
        <section className="space-y-4">
          <div className="panel p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-slate-950">
                Очікують перевірки
              </h2>
              <span className="status-pill bg-amber-100 text-amber-800">
                {pendingLessons.length} на модерації
              </span>
            </div>
          </div>

          {pendingError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Не вдалося завантажити уроки: {pendingError.message}
            </div>
          ) : null}

          {pendingLessons.length > 0 ? (
            <div className="space-y-4">
              {pendingLessons.map((lesson) => (
                <article className="panel p-5" key={lesson.id}>
                  <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          {lesson.subjects?.title ?? "Предмет"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          {lesson.courses?.title ?? "Без курсу"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5" />
                          {lesson.profiles?.username ?? "Автор"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Intl.DateTimeFormat("uk-UA").format(
                            new Date(lesson.created_at),
                          )}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-950">
                          {lesson.title}
                        </h3>
                        <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-6 text-slate-600">
                          {lesson.content.slice(0, 600)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Link className="btn-secondary w-full" href={`/lessons/${lesson.slug}/edit`}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Редагувати
                      </Link>

                      <form action={approveLessonAction}>
                        <input name="lesson_id" type="hidden" value={lesson.id} />
                        <button className="btn-primary w-full" type="submit">
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Затвердити
                        </button>
                      </form>

                      <form action={rejectLessonAction} className="space-y-2">
                        <input name="lesson_id" type="hidden" value={lesson.id} />
                        <label className="field-label" htmlFor={`reason-${lesson.id}`}>
                          Причина відхилення
                        </label>
                        <textarea
                          className="field-input min-h-24 resize-y"
                          id={`reason-${lesson.id}`}
                          name="rejection_reason"
                          placeholder="Що потрібно виправити?"
                          required
                        />
                        <SubmitButton
                          label="Відхилити"
                          pendingLabel="Відхиляємо..."
                          variant="danger"
                        />
                      </form>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel p-6 text-center text-sm text-slate-600">
              Немає уроків, що очікують перевірки.
            </div>
          )}

          <div className="panel p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-slate-950">
                Затверджені уроки
              </h2>
              <span className="status-pill bg-emerald-100 text-emerald-800">
                {approvedLessons.length} опубліковано
              </span>
            </div>

            {approvedLessons.length > 0 ? (
              <LessonOrderingList groups={approvedLessonGroups} />
            ) : (
              <p className="text-sm text-slate-600">
                Затверджених уроків поки немає.
              </p>
            )}
          </div>
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

      {activeTab === "exams" ? (
        <section className="space-y-6">
          <div className="panel p-5">
            <div className="mb-4 flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-emerald-700" aria-hidden="true" />
              <h2 className="text-xl font-bold text-slate-950">Новий іспит</h2>
            </div>
            <form action={createExamAction} className="grid gap-4 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="field-label" htmlFor="subject_id">
                  Предмет
                </label>
                <select className="field-input" id="subject_id" name="subject_id" required>
                  <option value="">Оберіть предмет</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="exam-title">
                  Назва
                </label>
                <input className="field-input" id="exam-title" name="title" required />
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="pass_score">
                  Мінімальний бал, %
                </label>
                <input
                  className="field-input"
                  defaultValue={70}
                  id="pass_score"
                  max={100}
                  min={0}
                  name="pass_score"
                  required
                  type="number"
                />
              </div>
              <div className="space-y-2 lg:col-span-4">
                <label className="field-label" htmlFor="description">
                  Опис
                </label>
                <textarea
                  className="field-input min-h-20 resize-y"
                  id="description"
                  name="description"
                />
              </div>
              <div className="lg:col-span-4">
                <SubmitButton label="Створити іспит" pendingLabel="Створюємо..." />
              </div>
            </form>
          </div>

          {exams.length > 0 ? (
            exams.map((exam) => {
              const questionsForExam = examQuestions.filter(
                (question) => question.exam_id === exam.id,
              );

              return (
                <article className="panel p-5" key={exam.id}>
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        {exam.subjects?.title ?? "Предмет"}
                      </p>
                      <h3 className="mt-1 text-xl font-bold text-slate-950">
                        {exam.title}
                      </h3>
                    </div>
                    <span className="status-pill bg-emerald-100 text-emerald-800">
                      Мінімум {exam.pass_score}%
                    </span>
                  </div>

                  <form action={updateExamAction} className="grid gap-4 lg:grid-cols-4">
                    <input name="exam_id" type="hidden" value={exam.id} />
                    <div className="space-y-2">
                      <label className="field-label" htmlFor={`subject-${exam.id}`}>
                        Предмет
                      </label>
                      <select
                        className="field-input"
                        defaultValue={exam.subject_id}
                        id={`subject-${exam.id}`}
                        name="subject_id"
                        required
                      >
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="field-label" htmlFor={`title-${exam.id}`}>
                        Назва
                      </label>
                      <input
                        className="field-input"
                        defaultValue={exam.title}
                        id={`title-${exam.id}`}
                        name="title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="field-label" htmlFor={`pass-${exam.id}`}>
                        Мінімальний бал
                      </label>
                      <input
                        className="field-input"
                        defaultValue={exam.pass_score}
                        id={`pass-${exam.id}`}
                        max={100}
                        min={0}
                        name="pass_score"
                        required
                        type="number"
                      />
                    </div>
                    <div className="space-y-2 lg:col-span-4">
                      <label className="field-label" htmlFor={`description-${exam.id}`}>
                        Опис
                      </label>
                      <textarea
                        className="field-input min-h-20 resize-y"
                        defaultValue={exam.description ?? ""}
                        id={`description-${exam.id}`}
                        name="description"
                      />
                    </div>
                    <div className="lg:col-span-4">
                      <SubmitButton label="Оновити іспит" pendingLabel="Оновлюємо..." />
                    </div>
                  </form>

                  <form action={deleteExamAction} className="mt-3">
                    <input name="exam_id" type="hidden" value={exam.id} />
                    <DeleteButton label="Видалити іспит" />
                  </form>

                  <div className="mt-6 grid gap-5 lg:grid-cols-[380px_1fr]">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <h4 className="mb-4 font-bold text-slate-950">
                        Додати питання
                      </h4>
                      <QuestionForm examId={exam.id} kind="exam-question" />
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-950">
                        Питання іспиту ({questionsForExam.length})
                      </h4>
                      {questionsForExam.length > 0 ? (
                        questionsForExam.map((question) => (
                          <div className="rounded-lg border border-slate-200 p-4" key={question.id}>
                            <QuestionForm
                              examId={exam.id}
                              kind="exam-question"
                              question={question}
                            />
                            <form action={deleteExamQuestionAction} className="mt-3">
                              <input name="question_id" type="hidden" value={question.id} />
                              <DeleteButton label="Видалити питання" />
                            </form>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
                          Питання ще не додані.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="panel p-6 text-sm text-slate-600">
              Іспити ще не створені.
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}

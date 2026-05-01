import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { submitExamAttemptAction } from "@/app/subjects/[slug]/exam/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { formatAnswer } from "@/lib/answers";
import { createClient } from "@/lib/supabase/server";
import type { Exam, ExamAttempt, ExamQuestion, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

type ExamPageProps = {
  params: {
    slug: string;
  };
  searchParams: {
    attempt?: string;
    error?: string;
  };
};

type ExamWithSubject = Exam & {
  subjects?: Pick<Subject, "title" | "slug"> | null;
};

export default async function ExamPage({ params, searchParams }: ExamPageProps) {
  const supabase = createClient();
  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle<Subject>();

  if (subjectError || !subject) {
    notFound();
  }

  const { data: exam } = await supabase
    .from("exams")
    .select("*, subjects(title, slug)")
    .eq("subject_id", subject.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ExamWithSubject>();

  if (!exam) {
    return (
      <section className="page-shell space-y-6">
        <Link className="btn-secondary" href={`/subjects/${subject.slug}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          До предмета
        </Link>
        <div className="panel p-6 text-center">
          <h1 className="text-2xl font-bold text-slate-950">
            Іспит ще не створено
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Для цього предмета поки немає доступного іспиту.
          </p>
        </div>
      </section>
    );
  }

  const [{ data: questions }, authResult] = await Promise.all([
    supabase
      .from("exam_questions")
      .select("*")
      .eq("exam_id", exam.id)
      .order("order_index", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  const examQuestions = (questions ?? []) as ExamQuestion[];
  const user = authResult.data.user;

  let attempt: ExamAttempt | null = null;

  if (searchParams.attempt && user) {
    const { data } = await supabase
      .from("exam_attempts")
      .select("*")
      .eq("id", searchParams.attempt)
      .eq("user_id", user.id)
      .maybeSingle<ExamAttempt>();

    attempt = data ?? null;
  }

  return (
    <section className="page-shell space-y-6">
      <Link className="btn-secondary" href={`/subjects/${subject.slug}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        До предмета
      </Link>

      <div className="panel p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Іспит з предмета {subject.title}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{exam.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {exam.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="status-pill bg-slate-100 text-slate-700">
            {examQuestions.length} питань
          </span>
          <span className="status-pill bg-emerald-100 text-emerald-800">
            Мінімальний бал: {exam.pass_score}%
          </span>
        </div>
      </div>

      {searchParams.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {searchParams.error}
        </div>
      ) : null}

      {attempt ? (
        <div
          className={`panel p-6 ${
            attempt.passed ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p
                className={`text-sm font-semibold uppercase tracking-wide ${
                  attempt.passed ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                Результат
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                {attempt.passed
                  ? "Вітаємо! Ви склали іспит"
                  : `Спробуйте ще раз. Мінімальний бал: ${exam.pass_score}%`}
              </h2>
            </div>
            <span className="text-4xl font-bold text-slate-950">
              {attempt.score}%
            </span>
          </div>
        </div>
      ) : null}

      {examQuestions.length > 0 ? (
        <form action={submitExamAttemptAction} className="space-y-5">
          <input name="exam_id" type="hidden" value={exam.id} />
          <input name="subject_slug" type="hidden" value={subject.slug} />

          {examQuestions.map((question, index) => {
            const answer = attempt?.answers?.[question.id] ?? "";
            const isCorrect = attempt
              ? answer === question.correct_answer
              : false;
            const showResult = Boolean(attempt);

            return (
              <fieldset
                className={`rounded-lg border bg-white p-5 shadow-sm ${
                  !showResult
                    ? "border-slate-200"
                    : isCorrect
                      ? "border-emerald-300"
                      : "border-rose-300"
                }`}
                key={question.id}
              >
                <legend className="px-1 text-sm font-semibold text-slate-500">
                  Питання {index + 1}
                </legend>
                <p className="mt-2 font-semibold leading-7 text-slate-950">
                  {question.question}
                </p>

                <div className="mt-4 grid gap-2">
                  {question.options.map((option) => (
                    <label
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                      key={option}
                    >
                      <input
                        defaultChecked={answer === option}
                        name={`answer_${question.id}`}
                        required
                        type="radio"
                        value={option}
                      />
                      {formatAnswer(option, question.type)}
                    </label>
                  ))}
                </div>

                {showResult ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <p
                      className={`inline-flex items-center gap-2 font-semibold ${
                        isCorrect ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {isCorrect ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      )}
                      {isCorrect ? "Правильно" : "Неправильно"}
                    </p>
                    {!isCorrect ? (
                      <p className="text-slate-700">
                        Правильна відповідь:{" "}
                        <span className="font-semibold">
                          {formatAnswer(question.correct_answer, question.type)}
                        </span>
                      </p>
                    ) : null}
                    {question.explanation ? (
                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                        {question.explanation}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </fieldset>
            );
          })}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {user
                ? "Після надсилання спроба буде збережена у вашому кабінеті."
                : "Увійдіть, щоб зберегти результат іспиту."}
            </p>
            <div className="w-full sm:w-64">
              <SubmitButton
                label={attempt ? "Спробувати ще раз" : "Завершити іспит"}
                pendingLabel="Перевіряємо..."
              />
            </div>
          </div>
        </form>
      ) : (
        <div className="panel p-6 text-center text-sm text-slate-600">
          До цього іспиту ще не додано питань.
        </div>
      )}
    </section>
  );
}

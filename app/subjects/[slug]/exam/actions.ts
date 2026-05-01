"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAnswerCorrect } from "@/lib/answers";
import { createClient } from "@/lib/supabase/server";
import type { ExamQuestion } from "@/lib/types";

export async function submitExamAttemptAction(formData: FormData) {
  const examId = String(formData.get("exam_id") ?? "");
  const subjectSlug = String(formData.get("subject_slug") ?? "");

  if (!examId || !subjectSlug) {
    redirect("/");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/auth/login?message=${encodeURIComponent(
        "Увійдіть, щоб зберегти результат іспиту.",
      )}`,
    );
  }

  const [{ data: exam }, { data: questions, error }] = await Promise.all([
    supabase
      .from("exams")
      .select("id, pass_score")
      .eq("id", examId)
      .maybeSingle<{ id: string; pass_score: number }>(),
    supabase
      .from("exam_questions")
      .select("*")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true }),
  ]);

  if (!exam || error || !questions?.length) {
    redirect(
      `/subjects/${subjectSlug}/exam?error=${encodeURIComponent(
        "Не вдалося перевірити іспит.",
      )}`,
    );
  }

  const examQuestions = questions as ExamQuestion[];
  const answers = examQuestions.reduce<Record<string, string>>((acc, question) => {
    acc[question.id] = String(formData.get(`answer_${question.id}`) ?? "").trim();
    return acc;
  }, {});

  const correctCount = examQuestions.filter((question) =>
    isAnswerCorrect(answers[question.id] ?? "", question.correct_answer, question.type),
  ).length;
  const score = Math.round((correctCount / examQuestions.length) * 100);
  const passed = score >= exam.pass_score;

  const { data: attempt, error: attemptError } = await supabase
    .from("exam_attempts")
    .insert({
      user_id: user.id,
      exam_id: examId,
      score,
      passed,
      answers,
    })
    .select("id")
    .single<{ id: string }>();

  if (attemptError || !attempt) {
    redirect(
      `/subjects/${subjectSlug}/exam?error=${encodeURIComponent(
        "Не вдалося зберегти спробу іспиту.",
      )}`,
    );
  }

  revalidatePath(`/subjects/${subjectSlug}/exam`);
  revalidatePath("/dashboard");
  redirect(`/subjects/${subjectSlug}/exam?attempt=${attempt.id}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  checkKeywordAnswer,
  coerceKeywordGroups,
  parseKeywordGroups,
  type ExerciseSubmissionState,
  type LessonExercise,
} from "@/lib/exercises";
import { createClient } from "@/lib/supabase/server";

const PASSING_SCORE = 70;

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function lessonRedirect(
  lessonSlug: string,
  message: string,
  type: "message" | "error" = "message",
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/lessons/${lessonSlug}?${params.toString()}`);
}

export async function createLessonExerciseAction(formData: FormData) {
  const lessonId = getString(formData, "lesson_id");
  const lessonSlug = getString(formData, "lesson_slug");
  const title = getString(formData, "title");
  const prompt = getString(formData, "prompt");
  const rawKeywords = getString(formData, "required_keywords");
  const explanation = getString(formData, "explanation");

  if (!lessonId || !lessonSlug) {
    redirect("/");
  }

  if (!title || !prompt || !rawKeywords) {
    lessonRedirect(
      lessonSlug,
      "Заповніть назву, завдання і ключові відповіді.",
      "error",
    );
  }

  const requiredKeywords = parseKeywordGroups(rawKeywords);

  if (requiredKeywords.length === 0) {
    lessonRedirect(
      lessonSlug,
      "Додайте хоча б один обов'язковий ключ відповіді.",
      "error",
    );
  }

  const { supabase } = await requireAdmin();
  const { data: lastExercise } = await supabase
    .from("lesson_exercises")
    .select("order_index")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle<{ order_index: number }>();

  const { error } = await supabase.from("lesson_exercises").insert({
    lesson_id: lessonId,
    title,
    prompt,
    required_keywords: requiredKeywords,
    explanation: explanation || null,
    order_index: (lastExercise?.order_index ?? -1) + 1,
  });

  if (error) {
    lessonRedirect(lessonSlug, "Не вдалося додати вправу.", "error");
  }

  revalidatePath(`/lessons/${lessonSlug}`);
  lessonRedirect(lessonSlug, "Вправу додано.");
}

export async function deleteLessonExerciseAction(formData: FormData) {
  const exerciseId = getString(formData, "exercise_id");
  const lessonSlug = getString(formData, "lesson_slug");

  if (!exerciseId || !lessonSlug) {
    redirect("/");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("lesson_exercises")
    .delete()
    .eq("id", exerciseId);

  if (error) {
    lessonRedirect(lessonSlug, "Не вдалося видалити вправу.", "error");
  }

  revalidatePath(`/lessons/${lessonSlug}`);
  lessonRedirect(lessonSlug, "Вправу видалено.");
}

export async function submitLessonExercisesAction(
  _previousState: ExerciseSubmissionState,
  formData: FormData,
): Promise<ExerciseSubmissionState> {
  const lessonId = getString(formData, "lesson_id");
  const lessonSlug = getString(formData, "lesson_slug");

  if (!lessonId || !lessonSlug) {
    return {
      completedLesson: false,
      correctCount: 0,
      error: "Не вдалося визначити урок.",
      passed: false,
      results: [],
      score: 0,
      submitted: false,
      total: 0,
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      completedLesson: false,
      correctCount: 0,
      error: "Увійдіть, щоб перевірити вправи і зберегти прогрес.",
      passed: false,
      results: [],
      score: 0,
      submitted: false,
      total: 0,
    };
  }

  const { data: exercises, error: exercisesError } = await supabase
    .from("lesson_exercises")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (exercisesError) {
    return {
      completedLesson: false,
      correctCount: 0,
      error: "Не вдалося завантажити вправи для перевірки.",
      passed: false,
      results: [],
      score: 0,
      submitted: false,
      total: 0,
    };
  }

  const lessonExercises = ((exercises ?? []) as LessonExercise[]).map(
    (exercise) => ({
      ...exercise,
      required_keywords: coerceKeywordGroups(exercise.required_keywords),
    }),
  );
  const total = lessonExercises.length;

  if (total === 0) {
    return {
      completedLesson: false,
      correctCount: 0,
      error: "До цього уроку ще не додано вправи.",
      passed: false,
      results: [],
      score: 0,
      submitted: false,
      total: 0,
    };
  }

  const results = lessonExercises.map((exercise) => {
    const answer = String(formData.get(`answer_${exercise.id}`) ?? "");
    const checkedAnswer = checkKeywordAnswer(
      answer,
      exercise.required_keywords,
    );

    return {
      ...checkedAnswer,
      exerciseId: exercise.id,
    };
  });
  const correctCount = results.filter((result) => result.isCorrect).length;
  const score = Math.round((correctCount / total) * 100);
  const passed = score >= PASSING_SCORE;

  const { error: attemptError } = await supabase
    .from("lesson_exercise_attempts")
    .insert({
      user_id: user.id,
      lesson_id: lessonId,
      score,
      passed,
      answers: results,
    });

  if (attemptError) {
    return {
      completedLesson: false,
      correctCount,
      error: "Не вдалося зберегти результат проходження.",
      passed,
      results,
      score,
      submitted: true,
      total,
    };
  }

  if (passed) {
    const { error: progressError } = await supabase.from("progress").upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );

    if (progressError) {
      return {
        completedLesson: false,
        correctCount,
        error: "Вправи зараховано, але не вдалося оновити прогрес.",
        passed,
        results,
        score,
        submitted: true,
        total,
      };
    }
  }

  revalidatePath(`/lessons/${lessonSlug}`);
  revalidatePath("/dashboard");

  return {
    completedLesson: passed,
    correctCount,
    passed,
    results,
    score,
    submitted: true,
    total,
  };
}

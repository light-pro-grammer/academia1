"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { QuestionType } from "@/lib/types";

type MessageType = "message" | "error";

function adminRedirect(
  message: string,
  type: MessageType = "message",
  tab = "lessons",
): never {
  const params = new URLSearchParams({ tab, [type]: message });
  redirect(`/admin?${params.toString()}`);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOptions(formData: FormData) {
  try {
    const parsed = JSON.parse(getString(formData, "options_json")) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((option) => String(option).trim())
      .filter((option) => option.length > 0);
  } catch {
    return [];
  }
}

async function getUniqueCourseSlug(
  supabase: ReturnType<typeof createClient>,
  title: string,
) {
  const baseSlug = slugify(title);

  for (let index = 0; index < 20; index += 1) {
    const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const { data } = await supabase
      .from("courses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle<{ id: string }>();

    if (!data) {
      return slug;
    }
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeExercisePayload(formData: FormData) {
  const type = getString(formData, "type") as QuestionType;
  const orderIndex = Number.parseInt(getString(formData, "order_index") || "0", 10);
  const explanation = getString(formData, "explanation") || null;
  let options: string[] | null = null;
  const correctAnswer = getString(formData, "correct_answer");

  if (!["multiple_choice", "true_false", "open_text"].includes(type)) {
    throw new Error("Оберіть тип вправи.");
  }

  if (type === "multiple_choice") {
    options = getOptions(formData);

    if (options.length < 2 || !options.includes(correctAnswer)) {
      throw new Error("Для тесту додайте щонайменше дві опції та правильну відповідь.");
    }
  }

  if (type === "true_false") {
    options = ["true", "false"];

    if (!["true", "false"].includes(correctAnswer)) {
      throw new Error("Оберіть правильну відповідь для Правда/Хибно.");
    }
  }

  if (type === "open_text" && !correctAnswer) {
    throw new Error("Додайте правильну відповідь для відкритого питання.");
  }

  return {
    question: getString(formData, "question"),
    type,
    options,
    correct_answer: correctAnswer,
    explanation,
    order_index: Number.isNaN(orderIndex) ? 0 : orderIndex,
  };
}

function normalizeExamQuestionPayload(formData: FormData) {
  const payload = normalizeExercisePayload(formData);

  if (payload.type === "open_text") {
    throw new Error("Іспити підтримують лише тестові питання та Правда/Хибно.");
  }

  return {
    ...payload,
    type: payload.type as "multiple_choice" | "true_false",
    options: payload.options ?? [],
  };
}

export async function approveLessonAction(formData: FormData) {
  const lessonId = getString(formData, "lesson_id");

  if (!lessonId) {
    adminRedirect("Не вказано урок для затвердження.", "error");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("lessons")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", lessonId);

  if (error) {
    adminRedirect("Не вдалося затвердити урок.", "error");
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  adminRedirect("Урок затверджено.");
}

export async function rejectLessonAction(formData: FormData) {
  const lessonId = getString(formData, "lesson_id");
  const rejectionReason = getString(formData, "rejection_reason");

  if (!lessonId || !rejectionReason) {
    adminRedirect("Додайте причину відхилення.", "error");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("lessons")
    .update({ status: "rejected", rejection_reason: rejectionReason })
    .eq("id", lessonId);

  if (error) {
    adminRedirect("Не вдалося відхилити урок.", "error");
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  adminRedirect("Урок відхилено.");
}

export async function deleteLessonAction(formData: FormData) {
  const lessonId = getString(formData, "lesson_id");

  if (!lessonId) {
    adminRedirect("Не вказано урок для видалення.", "error");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);

  if (error) {
    adminRedirect("Не вдалося видалити урок.", "error");
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  adminRedirect("Урок видалено.");
}

export async function reorderLessonsAction(courseId: string | null, lessonIds: string[]) {
  const orderedIds = lessonIds.filter(Boolean);

  if (orderedIds.length === 0) {
    return;
  }

  const { supabase } = await requireAdmin();
  let query = supabase
    .from("lessons")
    .select("id, course_id, slug, courses(slug, subjects(slug))")
    .in("id", orderedIds);

  query = courseId ? query.eq("course_id", courseId) : query.is("course_id", null);

  const { data: lessons, error: lessonsError } = await query;

  if (lessonsError || !lessons || lessons.length !== orderedIds.length) {
    throw new Error("Не вдалося перевірити уроки для сортування.");
  }

  const updates = orderedIds.map((lessonId, orderIndex) =>
    supabase
      .from("lessons")
      .update({ order_index: orderIndex })
      .eq("id", lessonId),
  );
  const results = await Promise.all(updates);
  const failedUpdate = results.find((result) => result.error);

  if (failedUpdate?.error) {
    throw new Error("Не вдалося зберегти порядок уроків.");
  }

  revalidatePath("/admin");
  for (const lesson of lessons as Array<{
    slug: string;
    courses?: { slug?: string | null; subjects?: { slug?: string | null } | null } | null;
  }>) {
    revalidatePath(`/lessons/${lesson.slug}`);

    const subjectSlug = lesson.courses?.subjects?.slug;
    const courseSlug = lesson.courses?.slug;

    if (subjectSlug && courseSlug) {
      revalidatePath(`/subjects/${subjectSlug}/courses/${courseSlug}`);
    }
  }
}

export async function createCourseAction(formData: FormData) {
  const subjectId = getString(formData, "subject_id");
  const title = getString(formData, "title");

  if (!subjectId || !title) {
    adminRedirect("Оберіть предмет і введіть назву курсу.", "error", "courses");
  }

  const { supabase } = await requireAdmin();
  const [{ data: lastCourse }, slug] = await Promise.all([
    supabase
      .from("courses")
      .select("order_index")
      .eq("subject_id", subjectId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle<{ order_index: number }>(),
    getUniqueCourseSlug(supabase, title),
  ]);

  const { error } = await supabase.from("courses").insert({
    subject_id: subjectId,
    title,
    slug,
    order_index: (lastCourse?.order_index ?? 0) + 1,
  });

  if (error) {
    adminRedirect("Не вдалося створити курс.", "error", "courses");
  }

  revalidatePath("/admin");
  adminRedirect("Курс створено.", "message", "courses");
}

export async function updateCourseAction(formData: FormData) {
  const courseId = getString(formData, "course_id");
  const title = getString(formData, "title");

  if (!courseId || !title) {
    adminRedirect("Введіть назву курсу.", "error", "courses");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("courses")
    .update({ title })
    .eq("id", courseId);

  if (error) {
    adminRedirect("Не вдалося оновити курс.", "error", "courses");
  }

  revalidatePath("/admin");
  adminRedirect("Курс оновлено.", "message", "courses");
}

export async function deleteCourseAction(formData: FormData) {
  const courseId = getString(formData, "course_id");

  if (!courseId) {
    adminRedirect("Не вказано курс для видалення.", "error", "courses");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);

  if (error) {
    adminRedirect("Не вдалося видалити курс.", "error", "courses");
  }

  revalidatePath("/admin");
  adminRedirect("Курс видалено.", "message", "courses");
}

export async function createExamAction(formData: FormData) {
  const subjectId = getString(formData, "subject_id");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const passScore = Number.parseInt(getString(formData, "pass_score") || "70", 10);

  if (!subjectId || !title) {
    adminRedirect("Оберіть предмет і додайте назву іспиту.", "error", "exams");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("exams").insert({
    subject_id: subjectId,
    title,
    description,
    pass_score: Number.isNaN(passScore) ? 70 : passScore,
  });

  if (error) {
    adminRedirect("Не вдалося створити іспит.", "error", "exams");
  }

  revalidatePath("/admin");
  adminRedirect("Іспит створено.", "message", "exams");
}

export async function updateExamAction(formData: FormData) {
  const examId = getString(formData, "exam_id");
  const subjectId = getString(formData, "subject_id");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const passScore = Number.parseInt(getString(formData, "pass_score") || "70", 10);

  if (!examId || !subjectId || !title) {
    adminRedirect("Заповніть усі обов'язкові поля іспиту.", "error", "exams");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("exams")
    .update({
      subject_id: subjectId,
      title,
      description,
      pass_score: Number.isNaN(passScore) ? 70 : passScore,
    })
    .eq("id", examId);

  if (error) {
    adminRedirect("Не вдалося оновити іспит.", "error", "exams");
  }

  revalidatePath("/admin");
  adminRedirect("Іспит оновлено.", "message", "exams");
}

export async function deleteExamAction(formData: FormData) {
  const examId = getString(formData, "exam_id");

  if (!examId) {
    adminRedirect("Не вказано іспит для видалення.", "error", "exams");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("exams").delete().eq("id", examId);

  if (error) {
    adminRedirect("Не вдалося видалити іспит.", "error", "exams");
  }

  revalidatePath("/admin");
  adminRedirect("Іспит видалено.", "message", "exams");
}

export async function createExamQuestionAction(formData: FormData) {
  const examId = getString(formData, "exam_id");

  try {
    const payload = normalizeExamQuestionPayload(formData);

    if (!examId || !payload.question) {
      throw new Error("Оберіть іспит і заповніть питання.");
    }

    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("exam_questions")
      .insert({ ...payload, exam_id: examId });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    adminRedirect(
      error instanceof Error ? error.message : "Не вдалося створити питання.",
      "error",
      "exams",
    );
  }

  revalidatePath("/admin");
  adminRedirect("Питання іспиту створено.", "message", "exams");
}

export async function updateExamQuestionAction(formData: FormData) {
  const questionId = getString(formData, "question_id");

  try {
    const payload = normalizeExamQuestionPayload(formData);

    if (!questionId || !payload.question) {
      throw new Error("Заповніть питання іспиту.");
    }

    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("exam_questions")
      .update(payload)
      .eq("id", questionId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    adminRedirect(
      error instanceof Error ? error.message : "Не вдалося оновити питання.",
      "error",
      "exams",
    );
  }

  revalidatePath("/admin");
  adminRedirect("Питання іспиту оновлено.", "message", "exams");
}

export async function deleteExamQuestionAction(formData: FormData) {
  const questionId = getString(formData, "question_id");

  if (!questionId) {
    adminRedirect("Не вказано питання для видалення.", "error", "exams");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("exam_questions")
    .delete()
    .eq("id", questionId);

  if (error) {
    adminRedirect("Не вдалося видалити питання.", "error", "exams");
  }

  revalidatePath("/admin");
  adminRedirect("Питання видалено.", "message", "exams");
}

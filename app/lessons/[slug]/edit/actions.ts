"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Lesson } from "@/lib/types";
import type { createClient } from "@/lib/supabase/server";

function fail(slug: string, message: string): never {
  redirect(`/lessons/${slug}/edit?error=${encodeURIComponent(message)}`);
}

async function getNextLessonOrderIndex(
  supabase: ReturnType<typeof createClient>,
  courseId: string | null,
) {
  let query = supabase
    .from("lessons")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1);

  query = courseId ? query.eq("course_id", courseId) : query.is("course_id", null);

  const { data } = await query.maybeSingle<{ order_index: number }>();

  return (data?.order_index ?? -1) + 1;
}

export async function updateLessonAction(formData: FormData) {
  const lessonId = String(formData.get("lesson_id") ?? "");
  const lessonSlug = String(formData.get("lesson_slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "");
  const courseIdValue = String(formData.get("course_id") ?? "");
  const courseId = courseIdValue || null;
  const content = String(formData.get("content") ?? "").trim();

  if (!lessonId || !lessonSlug) {
    redirect("/dashboard?error=Не вдалося визначити урок для редагування.");
  }

  if (!title || !subjectId || !content) {
    fail(lessonSlug, "Заповніть назву, предмет і зміст уроку.");
  }

  const { supabase, user, profile } = await requireUser();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle<Lesson>();

  if (!lesson) {
    fail(lessonSlug, "Урок не знайдено.");
  }

  const isAdmin = profile?.role === "admin";
  const isAuthor = lesson.author_id === user.id;

  if (!isAdmin && !isAuthor) {
    redirect("/dashboard?error=Ви не можете редагувати цей урок.");
  }

  if (courseId) {
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("subject_id", subjectId)
      .maybeSingle<{ id: string }>();

    if (!course) {
      fail(lessonSlug, "Обраний курс не належить до вибраного предмета.");
    }
  }

  const courseChanged = courseId !== lesson.course_id;
  const orderIndex = courseChanged
    ? await getNextLessonOrderIndex(supabase, courseId)
    : lesson.order_index;

  const { error } = await supabase
    .from("lessons")
    .update({
      title,
      content,
      subject_id: subjectId,
      course_id: courseId,
      order_index: orderIndex,
      status: isAdmin ? "approved" : "pending",
      rejection_reason: null,
    })
    .eq("id", lesson.id);

  if (error) {
    fail(lessonSlug, "Не вдалося зберегти зміни уроку.");
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/lessons/${lesson.slug}`);
  revalidatePath(`/lessons/${lesson.slug}/edit`);

  if (isAdmin) {
    redirect(
      `/lessons/${lesson.slug}?message=${encodeURIComponent(
        "Урок оновлено та залишено затвердженим.",
      )}`,
    );
  }

  redirect(
    `/dashboard?message=${encodeURIComponent(
      "Урок оновлено і повернуто на модерацію.",
    )}`,
  );
}

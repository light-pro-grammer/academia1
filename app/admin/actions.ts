"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

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

export async function reorderLessonsAction(
  courseId: string | null,
  lessonIds: string[],
  orderOffset = 0,
) {
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

  const safeOrderOffset = Number.isFinite(orderOffset) ? orderOffset : 0;
  const updates = orderedIds.map((lessonId, orderIndex) =>
    supabase
      .from("lessons")
      .update({ order_index: safeOrderOffset + orderIndex })
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

function fail(message: string): never {
  redirect(`/lessons/create?error=${encodeURIComponent(message)}`);
}

async function getUniqueLessonSlug(
  supabase: ReturnType<typeof createClient>,
  title: string,
) {
  const baseSlug = slugify(title);

  for (let index = 0; index < 20; index += 1) {
    const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const { data } = await supabase
      .from("lessons")
      .select("id")
      .eq("slug", slug)
      .maybeSingle<{ id: string }>();

    if (!data) {
      return slug;
    }
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
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

export async function createLessonAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "");
  const courseIdValue = String(formData.get("course_id") ?? "");
  const courseId = courseIdValue || null;
  const content = String(formData.get("content") ?? "").trim();

  if (!title || !subjectId || !content) {
    fail("Заповніть назву, предмет і зміст уроку.");
  }

  const { supabase, user } = await requireAdmin();

  if (courseId) {
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("subject_id", subjectId)
      .maybeSingle<{ id: string }>();

    if (!course) {
      fail("Обраний курс не належить до вибраного предмета.");
    }
  }

  const [slug, orderIndex] = await Promise.all([
    getUniqueLessonSlug(supabase, title),
    getNextLessonOrderIndex(supabase, courseId),
  ]);
  const { error } = await supabase.from("lessons").insert({
    title,
    slug,
    content,
    subject_id: subjectId,
    course_id: courseId,
    author_id: user.id,
    status: "approved",
    order_index: orderIndex,
  });

  if (error) {
    fail("Не вдалося опублікувати урок.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  if (courseId) {
    const { data: course } = await supabase
      .from("courses")
      .select("slug, subjects(slug)")
      .eq("id", courseId)
      .maybeSingle<{ slug: string; subjects?: { slug?: string | null } | null }>();

    if (course?.subjects?.slug) {
      revalidatePath(`/subjects/${course.subjects.slug}/courses/${course.slug}`);
    }
  }

  redirect(
    `/lessons/${slug}?message=${encodeURIComponent(
      "Урок створено та опубліковано.",
    )}`,
  );
}

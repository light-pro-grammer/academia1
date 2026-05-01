"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function markLessonCompletedAction(formData: FormData) {
  const lessonId = String(formData.get("lesson_id") ?? "");
  const lessonSlug = String(formData.get("lesson_slug") ?? "");

  if (!lessonId || !lessonSlug) {
    redirect("/");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/auth/login?message=${encodeURIComponent(
        "Увійдіть, щоб зберегти прогрес.",
      )}`,
    );
  }

  const { error } = await supabase.from("progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );

  if (error) {
    redirect(
      `/lessons/${lessonSlug}?error=${encodeURIComponent(
        "Не вдалося оновити прогрес.",
      )}`,
    );
  }

  revalidatePath(`/lessons/${lessonSlug}`);
  revalidatePath("/dashboard");
  redirect(
    `/lessons/${lessonSlug}?message=${encodeURIComponent(
      "Урок позначено як завершений.",
    )}`,
  );
}

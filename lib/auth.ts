import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getSessionProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null as Profile | null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { supabase, user, profile: profile ?? null };
}

export async function requireUser() {
  const session = await getSessionProfile();

  if (!session.user) {
    redirect("/auth/login?message=Увійдіть, щоб продовжити.");
  }

  return session as Awaited<ReturnType<typeof getSessionProfile>> & {
    user: NonNullable<Awaited<ReturnType<typeof getSessionProfile>>["user"]>;
  };
}

export async function requireAdmin() {
  const session = await requireUser();

  if (session.profile?.role !== "admin") {
    redirect("/dashboard?error=Ця сторінка доступна лише адміністраторам.");
  }

  return session as typeof session & { profile: Profile };
}

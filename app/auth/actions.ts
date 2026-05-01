"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirectWithError("/auth/login", "Введіть email і пароль.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirectWithError("/auth/login", "Не вдалося увійти. Перевірте дані.");
  }

  redirect("/dashboard");
}

export async function registerAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !email || !password) {
    redirectWithError("/auth/register", "Заповніть усі поля.");
  }

  if (password.length < 6) {
    redirectWithError("/auth/register", "Пароль має містити щонайменше 6 символів.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  if (error) {
    redirectWithError("/auth/register", "Не вдалося створити акаунт.");
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(
    `/auth/login?message=${encodeURIComponent(
      "Акаунт створено. Якщо у Supabase увімкнено підтвердження email, перевірте пошту.",
    )}`,
  );
}

export async function logoutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  created_at: string;
};

export type Subject = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  created_at: string;
};

export type Course = {
  id: string;
  subject_id: string;
  title: string;
  slug: string;
  description: string | null;
  order_index: number;
  created_at: string;
};

export type LessonStatus = "pending" | "approved" | "rejected";

export type Lesson = {
  id: string;
  title: string;
  slug: string;
  content: string;
  subject_id: string;
  course_id: string | null;
  author_id: string;
  status: LessonStatus;
  rejection_reason: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type Progress = {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
};

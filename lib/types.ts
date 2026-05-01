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

export type QuestionType = "multiple_choice" | "true_false" | "open_text";

export type Exercise = {
  id: string;
  lesson_id: string;
  question: string;
  type: QuestionType;
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  order_index: number;
  created_at: string;
};

export type ExerciseResult = {
  id: string;
  user_id: string;
  exercise_id: string;
  lesson_id: string;
  answer: string;
  is_correct: boolean;
  created_at: string;
};

export type Exam = {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  pass_score: number;
  created_at: string;
};

export type ExamQuestion = {
  id: string;
  exam_id: string;
  question: string;
  type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
  explanation: string | null;
  order_index: number;
};

export type ExamAttempt = {
  id: string;
  user_id: string;
  exam_id: string;
  score: number;
  passed: boolean;
  answers: Record<string, string>;
  completed_at: string;
};

import { BookOpen } from "lucide-react";

const emojiIconMap = {
  atom: "⚛️",
  calculator: "🧮",
  dna: "🧬",
  flask: "🧪",
  globe: "🌎",
  landmark: "🏛️",
  languages: "🗣️",
  music: "🎵",
} as const;

type SubjectIconProps = {
  name: string | null;
  className?: string;
};

export function SubjectIcon({ name, className = "h-5 w-5" }: SubjectIconProps) {
  const emoji =
    name?.startsWith("emoji:")
      ? name.replace("emoji:", "")
      : emojiIconMap[name as keyof typeof emojiIconMap];

  if (emoji) {
    return (
      <span className="text-2xl leading-none" aria-hidden="true">
        {emoji}
      </span>
    );
  }

  return <BookOpen className={className} aria-hidden="true" />;
}

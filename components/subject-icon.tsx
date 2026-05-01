import {
  Atom,
  BookOpen,
  Calculator,
  Dna,
  FlaskConical,
  Globe2,
  Landmark,
  Languages,
  Music,
} from "lucide-react";

const iconMap = {
  atom: Atom,
  book: BookOpen,
  calculator: Calculator,
  dna: Dna,
  flask: FlaskConical,
  globe: Globe2,
  landmark: Landmark,
  languages: Languages,
  music: Music,
};

type SubjectIconProps = {
  name: string | null;
  className?: string;
};

export function SubjectIcon({ name, className = "h-5 w-5" }: SubjectIconProps) {
  const Icon = iconMap[(name ?? "book") as keyof typeof iconMap] ?? BookOpen;

  return <Icon className={className} aria-hidden="true" />;
}

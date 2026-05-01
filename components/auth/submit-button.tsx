"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
};

export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const className =
    variant === "danger"
      ? "btn-danger w-full"
      : variant === "secondary"
        ? "btn-secondary w-full"
        : "btn-primary w-full";

  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}

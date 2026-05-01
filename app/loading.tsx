import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="page-shell">
      <div className="panel flex min-h-56 items-center justify-center gap-3 p-6 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Завантаження...
      </div>
    </div>
  );
}

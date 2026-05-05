import { FlaskConical } from "lucide-react";

export default function TestModeBanner({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs font-medium w-fit">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" />
      Mode test actif — les appels n8n vont sur le webhook-test
    </div>
  );
}

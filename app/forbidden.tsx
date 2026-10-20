// Shown when a Server Component calls forbidden() (see requireAdmin in lib/auth.ts).
import { Forbidden } from "@/components/forbidden";

export default function ForbiddenPage() {
  return <Forbidden />;
}

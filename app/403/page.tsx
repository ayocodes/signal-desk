// proxy.ts rewrites admin-only paths here for non-admins. Calling forbidden() while the page
// is prerendered makes Next serve app/forbidden.tsx with a real 403 status, which a rewrite
// alone can't set.
import { forbidden } from "next/navigation";

export default function Status403Page() {
  forbidden();
}

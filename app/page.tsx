import { redirect } from "next/navigation";

// proxy.ts normally redirects "/" first; this covers any request it skips.
export default function Home() {
  redirect("/queue");
}

import { BRAND_NAME } from "@/lib/brand";

// Replaced in C1.5, where proxy.ts sends "/" to /queue.
export default function Home() {
  return <main className="p-6">{BRAND_NAME}</main>;
}

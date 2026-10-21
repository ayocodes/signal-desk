// The current time for one request, read once by a page and passed down as `now`.
// With Cache Components, reading the clock while Next prerenders is an error, so this first
// marks the render as request-time (connection()). Passing one value down also means the
// server and the browser show the same relative ages ("6h ago").
import "server-only";
import { connection } from "next/server";

export async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}

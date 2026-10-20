// Server-side environment. Importing this from a client component is a build error.
import "server-only";
import { parseServerEnv } from "./env-schema";

export const env = parseServerEnv(process.env);

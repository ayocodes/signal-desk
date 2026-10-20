"use client";

// Bare, working login. Flash designs it in F1.4; keep the actions, field names and button values.
import { useActionState } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { signIn, signInAsDemo, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export default function LoginPage() {
  const [signInState, signInAction, signingIn] = useActionState(signIn, initialState);
  const [demoState, demoAction, signingInDemo] = useActionState(signInAsDemo, initialState);
  const error = signInState.error ?? demoState.error;
  const busy = signingIn || signingInDemo;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <h1>{BRAND_NAME}</h1>

      <form action={signInAction} className="flex flex-col gap-2">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="border" />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="border" />
        <button type="submit" disabled={busy} className="border">
          Sign in
        </button>
      </form>

      <form action={demoAction} className="flex gap-2">
        <button type="submit" name="role" value="admin" disabled={busy} className="border">
          Use demo admin
        </button>
        <button type="submit" name="role" value="rep" disabled={busy} className="border">
          Use demo rep
        </button>
      </form>

      {error && <p role="alert">{error}</p>}
    </main>
  );
}

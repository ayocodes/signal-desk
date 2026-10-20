"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { BRAND_NAME } from "@/lib/brand";
import { signIn, signInAsDemo, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export default function LoginPage() {
  const [signInState, signInAction, signingIn] = useActionState(signIn, initialState);
  const [demoState, demoAction, signingInDemo] = useActionState(signInAsDemo, initialState);
  const error = signInState.error ?? demoState.error;
  const busy = signingIn || signingInDemo;

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-bg text-text">
      <div className="w-full max-w-sm rounded-panel border border-border bg-surface p-6 shadow-xs">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-title font-semibold tracking-tight text-text">
            {BRAND_NAME}
          </h1>
          <p className="text-meta text-muted mt-1">
            Sign in to your workspace
          </p>
        </div>

        {/* Error message slot */}
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-control border border-bad/30 bg-bad/10 p-2.5 text-meta text-bad"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form action={signInAction} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5 text-left">
            <label htmlFor="email" className="text-meta font-medium text-text">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@company.com"
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-1.5 text-left">
            <label htmlFor="password" className="text-meta font-medium text-text">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              disabled={busy}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={busy}
            className="w-full mt-1"
          >
            {signingIn ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-border" />
          <span className="absolute bg-surface px-2 text-label uppercase tracking-wider text-muted font-mono select-none">
            or demo accounts
          </span>
        </div>

        {/* Demo Accounts Form */}
        <form action={demoAction} className="flex flex-col sm:flex-row gap-2">
          <Button
            type="submit"
            name="role"
            value="admin"
            variant="secondary"
            size="md"
            disabled={busy}
            className="flex-1"
          >
            Use demo admin
          </Button>
          <Button
            type="submit"
            name="role"
            value="rep"
            variant="secondary"
            size="md"
            disabled={busy}
            className="flex-1"
          >
            Use demo rep
          </Button>
        </form>
      </div>

      <p className="text-label text-muted text-center mt-6 select-none">
        Demo passwords stay on the server. Never email real people.
      </p>
    </main>
  );
}

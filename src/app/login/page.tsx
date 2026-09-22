"use client";

import { useActionState } from "react";
import { Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SubmitButton } from "@/components/shared/submit-button";
import { login } from "@/lib/actions/auth";
import { initialActionState } from "@/lib/actions/shared";

export default function LoginPage() {
  const [state, formAction] = useActionState(login, initialActionState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="size-5" />
          </div>
          <CardTitle className="text-xl">Expense Tracker</CardTitle>
          <CardDescription>Sign in to view your finances.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div>
              <Label htmlFor="username" className="mb-1.5">Username</Label>
              <Input id="username" name="username" autoComplete="username" required autoFocus />
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {state.status === "error" && state.message && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}
            <SubmitButton className="w-full">Sign In</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

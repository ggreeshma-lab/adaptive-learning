import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Brain, Loader2 } from "lucide-react";
import {
  getCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
  USE_LIVE_QUESTIONS,
  type AuthUser,
} from "@/services/api";

interface AuthGateProps {
  children: (user: AuthUser, onLogout: () => Promise<void>) => ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  useEffect(() => {
    if (!USE_LIVE_QUESTIONS) {
      setLoading(false);
      return;
    }
    getCurrentUser()
      .then(setUser)
      .catch((error: unknown) => {
        setInitialError(error instanceof Error ? error.message : "Unable to connect to the API.");
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await logoutAccount();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-label="Checking login" />
      </div>
    );
  }

  if (!USE_LIVE_QUESTIONS) {
    return children({ id: "mock-user", username: "demo" }, async () => {});
  }
  if (user) return children(user, logout);

  return <AuthForm onAuthenticated={setUser} initialError={initialError} />;
}

function AuthForm({
  onAuthenticated,
  initialError,
}: {
  onAuthenticated: (user: AuthUser) => void;
  initialError: string | null;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user =
        mode === "register"
          ? await registerAccount(username, password)
          : await loginAccount(username, password);
      onAuthenticated(user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-brand shadow-glow">
            <Brain className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AdaptIQ</h1>
            <p className="text-sm text-muted-foreground">Sign in to save your learning progress</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1">
          {(["login", "register"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setMode(item);
                setError(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium capitalize ${
                mode === item ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {item === "login" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {mode === "register" && (
            <p className="-mt-3 text-xs text-muted-foreground">
              Use 3–32 letters, numbers, or underscores.
            </p>
          )}
          <label className="block space-y-1.5 text-sm">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="block text-xs text-muted-foreground">Use at least 8 characters.</span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {mode === "register" ? "Create account" : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}

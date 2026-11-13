import { useId, useState, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useLogin, useRenewSession } from "@/hooks/useAuth";
import { apiErrorMessage } from "@/lib/csrfTransport";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const ids = useId();
  const login = useLogin();
  const renew = useRenewSession();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const busy = login.isPending || renew.isPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const watchCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState("CapsLock"));

  return (
    <div className="auth-card">
      <h1 className="type-page auth-title">Welcome back</h1>
      <p className="page-lede">Sign in to run the shop.</p>

      <form className="auth-form" onSubmit={handleSubmit(data => login.mutate({ ...data, username: data.username.trim() }))} noValidate>
        <div>
          <label htmlFor={`${ids}-username`} className="field-label">Username</label>
          <input
            id={`${ids}-username`}
            className="field-input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? `${ids}-username-error` : undefined}
            {...register("username")}
          />
          {errors.username && <p id={`${ids}-username-error`} className="field-error">{errors.username.message}</p>}
        </div>

        <div>
          <label htmlFor={`${ids}-password`} className="field-label">Password</label>
          <div className="auth-password">
            <input
              id={`${ids}-password`}
              type={showPassword ? "text" : "password"}
              className="field-input"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={[errors.password && `${ids}-password-error`, capsLock && `${ids}-caps`].filter(Boolean).join(" ") || undefined}
              onKeyUp={watchCaps}
              onKeyDown={watchCaps}
              {...register("password")}
            />
            <button
              type="button"
              className="icon-button auth-reveal"
              onClick={() => setShowPassword(shown => !shown)}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              <span className="sr-only">Show password</span>
            </button>
          </div>
          {capsLock && <p id={`${ids}-caps`} className="auth-caps">Caps Lock is on.</p>}
          {errors.password && <p id={`${ids}-password-error`} className="field-error">{errors.password.message}</p>}
        </div>

        {login.isError && (
          <p className="auth-error" role="alert">
            {apiErrorMessage(login.error, "That username and password don't match. Check them and try again.")}
          </p>
        )}

        <button type="submit" className="btn-primary auth-submit" disabled={busy} aria-busy={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="auth-renew">
        Still signed in from earlier on this device?{" "}
        <button type="button" className="link-button" disabled={busy} onClick={() => renew.mutate()}>
          {renew.isPending ? "Checking…" : "Continue"}
        </button>
      </p>
    </div>
  );
}

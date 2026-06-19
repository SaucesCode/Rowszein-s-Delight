import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin } from "@/hooks/useAuth";

/* ─────────────────────────────────────────────
   SCHEMA
   ───────────────────────────────────────────── */
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

/* ─────────────────────────────────────────────
   FIELD — labeled input block
   ───────────────────────────────────────────── */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {error && (
        <p className="field-error mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */
export default function LoginPage() {
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginForm) => {
    login.mutate(data);
  };

  return (
    <div
      className="card-surface p-8 w-full"
      style={{ boxShadow: "0 8px 32px rgba(107, 66, 38, 0.12)" }}
    >
      {/* Header */}
      <div className="mb-6">
        <h1
          className="font-heading font-semibold"
          style={{ fontSize: 18, color: "#6B4226", lineHeight: 1.3 }}
        >
          Welcome back
        </h1>
        <p className="font-body mt-1" style={{ fontSize: 13, color: "#9B6644" }}>
          Sign in to manage your shop
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Username" error={errors.username?.message}>
          <input
            {...register("username")}
            type="text"
            className="field-input mt-1"
            placeholder="Enter your username"
            autoComplete="username"
            autoFocus
            aria-invalid={!!errors.username}
          />
        </Field>

        <Field label="Password" error={errors.password?.message}>
          <input
            {...register("password")}
            type="password"
            className="field-input mt-1"
            placeholder="Enter your password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
          />
        </Field>

        <div className="pt-1">
          <button
            type="submit"
            disabled={login.isPending}
            className="btn-primary w-full justify-center"
            style={{ padding: "10px 20px", fontSize: 14 }}
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>

      {/* Error state — wrong credentials */}
      {login.isError && (
        <div
          className="mt-4 px-4 py-3 animate-slide-up"
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
          }}
          role="alert"
        >
          <p className="font-body" style={{ fontSize: 13, color: "#B91C1C" }}>
            Incorrect username or password. Please try again.
          </p>
        </div>
      )}
    </div>
  );
}

import { Outlet } from "react-router-dom";
import { CakeSlice } from "lucide-react";

export default function AuthLayout() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#FFF8F0" }}
    >
      {/* Decorative background rings — purely visual */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 500,
            height: 500,
            top: -180,
            right: -140,
            background: "radial-gradient(circle, #FFD6E7 0%, transparent 70%)",
            opacity: 0.45,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 360,
            height: 360,
            bottom: -120,
            left: -100,
            background: "radial-gradient(circle, #FFD6E7 0%, transparent 70%)",
            opacity: 0.3,
          }}
        />
      </div>

      {/* Shop logo mark */}
      <div className="relative mb-6 text-center animate-slide-up">
        <div
          className="inline-flex items-center justify-center rounded-2xl mb-3"
          style={{
            width: 52,
            height: 52,
            background: "linear-gradient(135deg, #FF6FAE 0%, #E5528A 100%)",
            boxShadow: "0 4px 16px rgba(255,111,174,0.40)",
          }}
        >
          <CakeSlice size={26} color="#FFFFFF" />
        </div>
        <p
          className="font-heading font-semibold"
          style={{ fontSize: 20, color: "#6B4226", lineHeight: 1.2 }}
        >
          Rowszein's Delight
        </p>
        <p className="font-body mt-1" style={{ fontSize: 13, color: "#9B6644" }}>
          Owner Portal
        </p>
      </div>

      {/* Page content (LoginPage renders here) */}
      <div className="relative w-full max-w-sm animate-slide-up">
        <Outlet />
      </div>

      {/* Footer */}
      <p className="relative mt-8 font-body" style={{ fontSize: 12, color: "#A8A49B" }}>
        © {new Date().getFullYear()} Rowszein's Delight
      </p>
    </div>
  );
}

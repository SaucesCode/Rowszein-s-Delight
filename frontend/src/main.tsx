import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import Router from "@/router";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/geist/index.css";
import "./index.css";
import "./workspace.css";
import "./styles/forms.css";
import "./styles/level-bar.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-control)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            boxShadow: "var(--shadow-card)",
          },
          success: {
            iconTheme: {
              primary: "var(--color-good)",
              secondary: "var(--color-surface)",
            },
          },
          error: {
            iconTheme: {
              primary: "var(--color-danger)",
              secondary: "var(--color-surface)",
            },
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);

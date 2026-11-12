import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import Router from "@/router";
import "./index.css";
import "./workspace.css";

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
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--ws-paper)",
            color: "var(--ws-ink)",
            border: "1px solid var(--ws-rule)",
            borderRadius: "var(--ws-radius-control)",
            fontSize: 13,
            fontFamily: "var(--ws-sans)",
            boxShadow: "var(--ws-shadow)",
          },
          success: {
            iconTheme: {
              primary: "var(--ws-success)",
              secondary: "var(--ws-paper)",
            },
          },
          error: {
            iconTheme: {
              primary: "var(--ws-danger)",
              secondary: "var(--ws-paper)",
            },
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);

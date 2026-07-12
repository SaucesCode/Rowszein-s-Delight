import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import Router from "@/router";
import "./index.css";

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
          // Brand-pink default styling for every toast in the app —
          // react-hot-toast ships with plain white/black by default,
          // which doesn't match the warm donut-shop palette.
          style: {
            background: "#FFFDFB",
            color: "#6B4226",
            border: "1px solid #F5EDE0",
            borderRadius: 10,
            fontSize: 13,
            fontFamily: "Inter, system-ui, sans-serif",
            boxShadow: "0 8px 24px rgba(107, 66, 38, 0.12)",
          },
          success: {
            iconTheme: {
              primary: "#FF6FAE",
              secondary: "#FFFDFB",
            },
          },
          error: {
            // Errors keep red so they still read as "something went
            // wrong" rather than blending in with success toasts.
            iconTheme: {
              primary: "#EF4444",
              secondary: "#FFFDFB",
            },
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);

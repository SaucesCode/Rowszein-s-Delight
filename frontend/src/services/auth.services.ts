import api from "./api";
import { authLifecycle } from "@/lib/authLifecycle";

export interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "staff";
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export const authService = {
  login: async (credentials: LoginCredentials) => {
    // Login/logout use the same lock as refresh where available. Neither is
    // automatically repeated when a response is lost.
    const response = await (navigator.locks ? authLifecycle.transition(() => api.post("/auth/login/", credentials)) : api.post("/auth/login/", credentials));
    return response.data;
  },

  logout: async () => {
    const response = await (navigator.locks ? authLifecycle.transition(() => api.post("/auth/logout/")) : api.post("/auth/logout/"));
    return response.data;
  },

  refresh: () => authLifecycle.refresh(async () => {
    const response = await api.post("/auth/refresh/");
    return response.data;
  }),

  me: async (): Promise<User> => {
    const response = await api.get("/auth/me/");
    return response.data.data;
  },
};

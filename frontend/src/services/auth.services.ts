import api from "./api";

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
    const response = await api.post("/auth/login/", credentials);
    return response.data;
  },

  logout: async () => {
    const response = await api.post("/auth/logout/");
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await api.get("/auth/me/");
    return response.data.data;
  },
};

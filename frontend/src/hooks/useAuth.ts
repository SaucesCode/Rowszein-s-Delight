import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authService } from "@/services/auth.services";
import type { LoginCredentials } from "@/services/auth.services";
import toast from "react-hot-toast";
import { apiErrorMessage } from "@/lib/csrfTransport";

export function useMe() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: authService.me,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (response) => {
      // Authentication transitions must not display another account's cached
      // business data. Pending operation identities remain actor-scoped storage.
      queryClient.clear();
      queryClient.setQueryData(["auth", "me"], response.data);
      toast.success("Welcome back!");
      navigate("/dashboard");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "Invalid username or password."));
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      queryClient.clear();
      toast.success("Logged out.");
      navigate("/login");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "Logout failed."));
    },
  });
}

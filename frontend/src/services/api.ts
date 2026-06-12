import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  withCredentials: true, // sends HttpOnly cookies automatically
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;

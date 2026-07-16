import axios from "axios";

export const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("codevia_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("codevia_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

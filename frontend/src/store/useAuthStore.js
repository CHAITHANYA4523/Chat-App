import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      
      // Handle different error scenarios
      if (error.response?.status === 401) {
        // User is not authenticated - this is expected on first load or session expired
        const errorMessage = error.response?.data?.message || "";
        if (errorMessage.includes("Token Expired")) {
          // Don't show error toast on initial load, only on actual expiration
          console.log("Token expired during auth check");
        }
        set({ authUser: null });
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        // Server is down or network error
        console.log("Server connection failed");
        toast.error("Unable to connect to server");
        set({ authUser: null });
      } else {
        // Other errors
        console.log("Unexpected error during auth check:", error);
        set({ authUser: null });
      }
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      console.log("Signup error:", error);
      const errorMessage = error.response?.data?.message || "Signup failed";
      toast.error(errorMessage);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      console.log("Login error:", error);
      const errorMessage = error.response?.data?.message || "Login failed";
      toast.error(errorMessage);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      console.log("Logout error:", error);
      // Even if logout fails on server, clear local state
      set({ authUser: null });
      get().disconnectSocket();
      const errorMessage = error.response?.data?.message || "Logout failed";
      toast.error(errorMessage);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      const errorMessage = error.response?.data?.message || "Profile update failed";
      toast.error(errorMessage);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  // Method to clear auth state - called by axios interceptor
  clearAuthOnUnauthorized: () => {
    const currentState = get();
    if (currentState.authUser) {
      set({ authUser: null });
      currentState.disconnectSocket();
      
      // Show appropriate message based on the error
      toast.error("Your session has expired. Please log in again.");
      
      // Optional: Redirect to login page after a short delay
      // setTimeout(() => {
      //   window.location.href = '/login';
      // }, 2000);
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
    });
    
    socket.connect();
    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("connect_error", (error) => {
      console.log("Socket connection error:", error);
    });
  },

  disconnectSocket: () => {
    if (get().socket?.connected) {
      get().socket.disconnect();
      set({ socket: null });
    }
  },
}));
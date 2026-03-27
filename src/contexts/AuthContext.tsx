import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface UserProfile {
  name: string;
  email: string;
  location: string;
  farmSize: string;
  preferredCrop: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (profile: UserProfile, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const API_BASE = import.meta.env.VITE_API_URL || "";

const tokenHeader = () => {
  const token = localStorage.getItem("agrismart_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("agrismart_token");
      if (!token) {
        const stored = localStorage.getItem("agrismart_user");
        if (stored) setUser(JSON.parse(stored));
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/user`, {
          headers: {
            "Content-Type": "application/json",
            ...tokenHeader(),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem("agrismart_user", JSON.stringify(data.user));
          return;
        }
      } catch {
        const stored = localStorage.getItem("agrismart_user");
        if (stored) setUser(JSON.parse(stored));
      }
    };
    load();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.success) return false;
      setUser(data.user);
      localStorage.setItem("agrismart_user", JSON.stringify(data.user));
      localStorage.setItem("agrismart_token", data.token);
      return true;
    } catch {
      const users = JSON.parse(localStorage.getItem("agrismart_users") || "{}");
      const entry = users[email.toLowerCase()];
      if (entry && entry.password === password) {
        setUser(entry.profile);
        localStorage.setItem("agrismart_user", JSON.stringify(entry.profile));
        return true;
      }
      return false;
    }
  };

  const signup = async (profile: UserProfile, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.success) return false;
      setUser(data.user);
      localStorage.setItem("agrismart_user", JSON.stringify(data.user));
      localStorage.setItem("agrismart_token", data.token);
      return true;
    } catch {
      const users = JSON.parse(localStorage.getItem("agrismart_users") || "{}");
      if (users[profile.email.toLowerCase()]) return false;
      users[profile.email.toLowerCase()] = { profile, password };
      localStorage.setItem("agrismart_users", JSON.stringify(users));
      setUser(profile);
      localStorage.setItem("agrismart_user", JSON.stringify(profile));
      return true;
    }
  };

  const logout = async () => {
    const token = localStorage.getItem("agrismart_token");
    if (token) {
      await fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        headers: { ...tokenHeader() },
      }).catch(() => undefined);
    }
    setUser(null);
    localStorage.removeItem("agrismart_token");
    localStorage.removeItem("agrismart_user");
  };

  const updateProfile = async (profile: UserProfile): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...tokenHeader(),
        },
        body: JSON.stringify(profile),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.success) return false;
      setUser(data.user);
      localStorage.setItem("agrismart_user", JSON.stringify(data.user));
      return true;
    } catch {
      setUser(profile);
      localStorage.setItem("agrismart_user", JSON.stringify(profile));
      const users = JSON.parse(localStorage.getItem("agrismart_users") || "{}");
      if (users[profile.email.toLowerCase()]) {
        users[profile.email.toLowerCase()].profile = profile;
        localStorage.setItem("agrismart_users", JSON.stringify(users));
      }
      return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, signup, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

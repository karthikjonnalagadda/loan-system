import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("auth");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem("auth", JSON.stringify(user));
    else localStorage.removeItem("auth");
  }, [user]);

  function setAuth(token, role, userObj) {
    setUser({ token, role, userObj });
  }

  function logout() {
    setUser(null);
  }

  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

  return (
    <AuthContext.Provider value={{ user, setAuth, logout, API_BASE }}>
      {children}
    </AuthContext.Provider>
  );
}

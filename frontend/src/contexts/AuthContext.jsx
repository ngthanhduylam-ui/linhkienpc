import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearAccessToken, setAuthFailureHandler } from "../auth/authTokenStore";
import {
  clearLegacyTokens,
  getMeRequest,
  loginRequest,
  logoutRequest,
  refreshRequest
} from "../services/auth.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const isAuthenticated = Boolean(admin);

  const login = useCallback(async (username, password) => {
    clearLegacyTokens();
    const data = await loginRequest(username, password);
    if (!data?.access_token || data?.refresh_token) {
      clearAccessToken();
      throw new Error("Phản hồi đăng nhập không hợp lệ.");
    }

    if (data.admin) {
      setAdmin(data.admin);
      return data.admin;
    }

    const profile = await getMeRequest();
    setAdmin(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (error) {
      // Local auth state is always cleared even if server revocation fails.
    } finally {
      clearAccessToken();
      clearLegacyTokens();
      setAdmin(null);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    clearLegacyTokens();
    const removeFailureHandler = setAuthFailureHandler(() => {
      if (isMounted) setAdmin(null);
    });

    async function bootstrapAuth() {
      try {
        const restored = await refreshRequest();
        if (!isMounted) return;
        if (restored?.admin) {
          setAdmin(restored.admin);
        } else {
          setAdmin(await getMeRequest());
        }
      } catch (error) {
        clearAccessToken();
        if (isMounted) setAdmin(null);
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    bootstrapAuth();
    return () => {
      isMounted = false;
      removeFailureHandler();
    };
  }, []);

  const value = useMemo(
    () => ({
      admin,
      isInitializing,
      loading: isInitializing,
      isAuthenticated,
      login,
      logout
    }),
    [admin, isInitializing, isAuthenticated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

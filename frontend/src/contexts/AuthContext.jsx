import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearTokens,
  getMeRequest,
  getStoredTokens,
  loginRequest,
  logoutRequest,
  refreshRequest,
  saveTokens
} from "../services/auth.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const isAuthenticated = Boolean(admin);

  const login = useCallback(async (username, password) => {
    const data = await loginRequest(username, password);
    if (!data?.access_token || !data?.refresh_token) {
      throw new Error("Phan hoi dang nhap khong hop le.");
    }

    saveTokens(data.access_token, data.refresh_token);
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
      const { refreshToken } = getStoredTokens();
      await logoutRequest(refreshToken);
    } catch (error) {
      // Luon clear token local ke ca khi revoke that bai.
    } finally {
      clearTokens();
      setAdmin(null);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      const { accessToken, refreshToken } = getStoredTokens();
      if (!accessToken) {
        if (isMounted) {
          setAdmin(null);
          setIsInitializing(false);
        }
        return;
      }

      try {
        const profile = await getMeRequest();
        if (isMounted) {
          setAdmin(profile);
        }
      } catch (error) {
        try {
          const refreshed = await refreshRequest(refreshToken);
          if (refreshed?.access_token && refreshed?.refresh_token) {
            saveTokens(refreshed.access_token, refreshed.refresh_token);
            const profile = await getMeRequest();
            if (isMounted) {
              setAdmin(profile);
            }
          } else if (isMounted) {
            clearTokens();
            setAdmin(null);
          }
        } catch (refreshError) {
          if (isMounted) {
            clearTokens();
            setAdmin(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    bootstrapAuth();
    return () => {
      isMounted = false;
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

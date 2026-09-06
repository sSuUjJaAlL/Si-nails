import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../services/api';
import type { User } from '../types';

type SetupStatus = {
  setupRequired: boolean;
  adminCount: number;
  maxAdmins: number;
  canCreateAdmin: boolean;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  setupRequired: boolean | null;
  setupMeta: SetupStatus | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  checkSetup: () => Promise<SetupStatus>;
  completeSetup: (payload: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<User>;
  signup: (payload: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<User>;
  updateProfile: (payload: {
    name: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }) => Promise<User>;
  isAdmin: boolean;
  isUser: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [setupMeta, setSetupMeta] = useState<SetupStatus | null>(null);

  const checkSetup = useCallback(async () => {
    const res = await api.get<SetupStatus>('/api/auth/setup-status');
    setSetupRequired(res.setupRequired);
    setSetupMeta(res);
    return res;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const setupRes = await api.get<SetupStatus>('/api/auth/setup-status');
      setSetupRequired(setupRes.setupRequired);
      setSetupMeta(setupRes);

      if (setupRes.setupRequired) {
        setUser(null);
        return;
      }

      const meRes = await api.get<{ user: User }>('/api/auth/me').catch(() => null);
      setUser(meRes?.user ?? null);
    } catch {
      setUser(null);
      setSetupRequired(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: User }>('/api/auth/login', { email, password });
    setUser(res.user);
    setSetupRequired(false);
    return res.user;
  }, []);

  const completeSetup = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) => {
      const res = await api.post<{ user: User; message: string }>('/api/auth/setup', payload);
      setUser(res.user);
      setSetupRequired(false);
      setSetupMeta({
        setupRequired: false,
        adminCount: 1,
        maxAdmins: 2,
        canCreateAdmin: true,
      });
      return res.user;
    },
    []
  );

  const signup = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) => {
      const status = await api.get<SetupStatus>('/api/auth/setup-status');
      if (status.setupRequired) {
        setSetupRequired(true);
        setSetupMeta(status);
        throw new ApiError('Studio setup is required first. Create the admin account.', 403);
      }
      const res = await api.post<{ user: User; message: string }>('/api/auth/signup', payload);
      setUser(res.user);
      setSetupRequired(false);
      return res.user;
    },
    []
  );

  const updateProfile = useCallback(
    async (payload: {
      name: string;
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    }) => {
      const res = await api.put<{ user: User; message: string }>('/api/auth/profile', payload);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    setUser(null);
    await checkSetup();
  }, [checkSetup]);

  const value = useMemo(
    () => ({
      user,
      loading,
      setupRequired,
      setupMeta,
      login,
      logout,
      refresh,
      checkSetup,
      completeSetup,
      signup,
      updateProfile,
      isAdmin: user?.role === 'ADMIN',
      isUser: user?.role === 'USER',
    }),
    [
      user,
      loading,
      setupRequired,
      setupMeta,
      login,
      logout,
      refresh,
      checkSetup,
      completeSetup,
      signup,
      updateProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

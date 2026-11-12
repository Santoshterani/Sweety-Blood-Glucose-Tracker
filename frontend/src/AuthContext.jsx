import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api.js';

const AuthContext = createContext(null);

// `user` is the patient's profile (name, email, target range, ...). Pages that change it call updateUser.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // While we check a saved token we don't know yet whether the user is logged in.
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [logout]);

  const startSession = useCallback(({ token, user }) => {
    tokenStore.set(token);
    setUser(user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, startSession, logout, updateUser: setUser }),
    [user, loading, startSession, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

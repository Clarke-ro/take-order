import React, { createContext, useContext } from 'react';

export type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId?: string | null;
  email?: string | null;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  email: null,
  signOut: async () => {},
});

export function useAppAuth(): AuthContextValue {
  return useContext(AuthContext);
}


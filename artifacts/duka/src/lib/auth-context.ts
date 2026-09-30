import React, { createContext, useContext } from 'react';

export type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId?: string | null;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  signOut: async () => {},
});

export function useAppAuth(): AuthContextValue {
  return useContext(AuthContext);
}

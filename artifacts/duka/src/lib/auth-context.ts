import { createContext, useContext } from 'react';

export type AuthState = 'loading' | 'signed_in' | 'signed_out';

export type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  authState: AuthState;
  userId?: string | null;
  email?: string | null;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({
  isLoaded: false,
  isSignedIn: false,
  authState: 'loading',
  userId: null,
  email: null,
  signOut: async () => {},
});

export function useAppAuth(): AuthContextValue {
  return useContext(AuthContext);
}



import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { cognitoAuth, type UserRole } from '../services/cognito';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  groups: UserRole[];
  email: string | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  devSignIn?: (wrestler: { wrestlerId: string; name: string }, roles?: UserRole[]) => void;
  isAdminOrModerator: boolean;
  isSuperAdmin: boolean;
  isModerator: boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: cognitoAuth.isAuthenticatedSync(),
    isLoading: true,
    groups: cognitoAuth.getUserGroups(),
    email: null,
  });

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Dev mode: restore dev session from sessionStorage
      if (import.meta.env.DEV) {
        const devWrestler = sessionStorage.getItem('devWrestler');
        if (devWrestler) {
          try {
            const wrestler = JSON.parse(devWrestler);
            if (!mounted) return;
            const groups = (wrestler.groups as UserRole[]) || ['Admin'];
            setState({
              isAuthenticated: true,
              isLoading: false,
              groups,
              email: `${(wrestler.name as string).toLowerCase().replace(/\s/g, '.')}@dev.local`,
            });
            return;
          } catch {
            sessionStorage.removeItem('devWrestler');
          }
        }
      }

      try {
        const user = await cognitoAuth.getCurrentUser();
        if (!mounted) return;

        if (user) {
          // Refresh tokens to get latest groups
          const session = await cognitoAuth.refreshSession();
          if (!mounted) return;

          const groups = session?.groups || cognitoAuth.getUserGroups();

          if (!mounted) return;
          setState({
            isAuthenticated: true,
            isLoading: false,
            groups,
            email: user.signInDetails?.loginId || user.username || null,
          });
        } else {
          setState({
            isAuthenticated: false,
            isLoading: false,
            groups: [],
            email: null,
          });
        }
      } catch {
        if (!mounted) return;
        setState({
          isAuthenticated: false,
          isLoading: false,
          groups: [],
          email: null,
        });
      }
    };
    init();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    const result = await cognitoAuth.signIn(email, password);

    setState({
      isAuthenticated: true,
      isLoading: false,
      groups: result.groups,
      email,
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    await cognitoAuth.signOut();
    sessionStorage.removeItem('devWrestler');
    setState({
      isAuthenticated: false,
      isLoading: false,
      groups: [],
      email: null,
    });
  }, []);

  const hasRole = useCallback((role: UserRole): boolean => {
    if (state.groups.includes('Admin')) return true;
    if (state.groups.includes('Moderator') && role !== 'Admin') return true;
    return state.groups.includes(role);
  }, [state.groups]);

  // Dev-only: sign in as a wrestler without Cognito
  const devSignIn = useCallback((wrestler: { wrestlerId: string; name: string }, roles?: UserRole[]) => {
    const groups = roles || ['Admin'];
    sessionStorage.setItem('accessToken', `dev-${wrestler.wrestlerId}`);
    sessionStorage.setItem('userGroups', JSON.stringify(groups));
    sessionStorage.setItem('devWrestler', JSON.stringify({ ...wrestler, groups }));
    setState({
      isAuthenticated: true,
      isLoading: false,
      groups,
      email: `${wrestler.name.toLowerCase().replace(/\s/g, '.')}@dev.local`,
    });
  }, []);

  const value: AuthContextType = {
    ...state,
    signIn: handleSignIn,
    signOut: handleSignOut,
    ...(import.meta.env.DEV ? { devSignIn } : {}),
    isAdminOrModerator: state.groups.includes('Admin') || state.groups.includes('Moderator'),
    isSuperAdmin: state.groups.includes('Admin'),
    isModerator: state.groups.includes('Moderator'),
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { api, setAuthFailureHandler, tokenStorage } from "./api";

export type PermissionAction = "view" | "edit" | "delete";

export interface RolePermission {
  module: string;
  actions: PermissionAction[];
}

export interface AuthRole {
  _id: string;
  name: string;
  description?: string;
  permissions: RolePermission[];
  isSystem?: boolean;
}

export interface AuthUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Populated role object (was a flat string before the Roles+Permissions refactor). */
  roleId?: AuthRole;
  status?: string;
  phone?: string;
  avatar?: string;
  department?: string;
}

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dealershipName?: string;
}

type AuthState =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: AuthUser }
  | { status: "unauthenticated"; user: null };

type AuthAction =
  | { type: "RESTORED"; user: AuthUser | null }
  | { type: "LOGIN_SUCCESS"; user: AuthUser }
  | { type: "USER_UPDATED"; user: AuthUser }
  | { type: "LOGOUT" };

const initialState: AuthState = { status: "loading", user: null };

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "RESTORED":
      return action.user
        ? { status: "authenticated", user: action.user }
        : { status: "unauthenticated", user: null };
    case "LOGIN_SUCCESS":
      return { status: "authenticated", user: action.user };
    case "USER_UPDATED":
      return state.status === "authenticated"
        ? { status: "authenticated", user: action.user }
        : state;
    case "LOGOUT":
      return { status: "unauthenticated", user: null };
    default:
      return state;
  }
}

export interface ProfileUpdateInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  department?: string;
  avatar?: string;
}

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Restore session on mount: if we have a token, fetch /users/me
  useEffect(() => {
    let cancelled = false;
    const accessToken = tokenStorage.getAccess();
    if (!accessToken) {
      dispatch({ type: "RESTORED", user: null });
      return;
    }
    api<AuthUser>("/users/me")
      .then((user) => {
        if (!cancelled) dispatch({ type: "RESTORED", user });
      })
      .catch(() => {
        if (!cancelled) {
          tokenStorage.clear();
          dispatch({ type: "RESTORED", user: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When the API client gives up on refresh, force logout
  useEffect(() => {
    setAuthFailureHandler(() => dispatch({ type: "LOGOUT" }));
    return () => setAuthFailureHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    tokenStorage.set(result.accessToken, result.refreshToken);
    dispatch({ type: "LOGIN_SUCCESS", user: result.user });
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await api<LoginResponse>("/auth/register", {
      method: "POST",
      body: input,
      auth: false,
    });
    tokenStorage.set(result.accessToken, result.refreshToken);
    dispatch({ type: "LOGIN_SUCCESS", user: result.user });
  }, []);

  const updateProfile = useCallback(async (input: ProfileUpdateInput): Promise<AuthUser> => {
    const userId = state.user?._id;
    if (!userId) throw new Error("Not authenticated");
    const updated = await api<AuthUser>(`/users/${userId}`, {
      method: "PATCH",
      body: input,
    });
    dispatch({ type: "USER_UPDATED", user: updated });
    return updated;
  }, [state.user?._id]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Even if the server call fails, clear local state.
    }
    tokenStorage.clear();
    dispatch({ type: "LOGOUT" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, register, logout, updateProfile }),
    [state, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

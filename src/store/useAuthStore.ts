import { create } from 'zustand';
import { AuthSession, User, Role } from '@/types';
import { authService } from '@/services/authService';

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  login: (username: string, pin: string, terminalId?: string) => Promise<AuthSession>;
  loginByPin: (pin: string, requiredRole?: Role, terminalId?: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  checkSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: authService.getCurrentSession(),
  isLoading: false,

  login: async (username, pin, terminalId = 'term_01') => {
    set({ isLoading: true });
    try {
      const session = await authService.login(username, pin, terminalId);
      set({ session, isLoading: false });
      return session;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginByPin: async (pin, requiredRole, terminalId = 'term_01') => {
    set({ isLoading: true });
    try {
      const session = await authService.loginByPin(pin, requiredRole, terminalId);
      set({ session, isLoading: false });
      return session;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      set({ session: null, isLoading: false });
    } catch (error) {
      set({ session: null, isLoading: false });
    }
  },

  checkSession: () => {
    const session = authService.getCurrentSession();
    set({ session });
  },
}));

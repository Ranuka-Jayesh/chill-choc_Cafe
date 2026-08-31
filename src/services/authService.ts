import { db } from './storage/db';
import { User, AuthSession, Role } from '@/types';

const SESSION_KEY = 'chill_choc_auth_session';

export const authService = {
  login: async (username: string, pinOrPassword: string, terminalId = 'term_01'): Promise<AuthSession> => {
    const data = db.getSnapshot();
    const user = data.users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.active
    );

    if (!user) {
      throw new Error('Invalid username or inactive account.');
    }

    // Support demo logins with standard passwords or PIN
    const isValid =
      (username === 'admin' && (pinOrPassword === 'admin123' || pinOrPassword === '1234' || pinOrPassword === 'admin')) ||
      (username === 'cashier' && (pinOrPassword === 'cashier123' || pinOrPassword === '1111' || pinOrPassword === 'cashier')) ||
      user.pin === pinOrPassword;

    if (!isValid) {
      throw new Error('Incorrect password or PIN code.');
    }

    const updatedUser: User = {
      ...user,
      lastLoginAt: new Date().toISOString(),
    };

    db.update('users', (users) =>
      users.map((u) => (u.id === user.id ? updatedUser : u))
    );

    const session: AuthSession = {
      user: updatedUser,
      token: `token_${user.id}_${Date.now()}`,
      terminalId,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    // Log audit
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        details: `User ${user.name} logged into ${terminalId}`,
        terminalId,
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    return session;
  },

  loginByPin: async (pin: string, requiredRole?: Role, terminalId = 'term_01'): Promise<AuthSession> => {
    const data = db.getSnapshot();
    const trimmed = pin.trim();

    const user = data.users.find(
      (u) =>
        u.active &&
        (u.pin === trimmed ||
          (u.username === 'admin' && (trimmed === '1234' || trimmed === 'admin123')) ||
          (u.username === 'cashier' && (trimmed === '1111' || trimmed === 'cashier123')))
    );

    if (!user) {
      throw new Error('Invalid PIN code. Please check and try again.');
    }

    if (requiredRole && requiredRole === 'ADMIN' && user.role !== 'ADMIN') {
      throw new Error('Cashiers do not have access to the Admin Portal.');
    }

    return authService.login(user.username, trimmed, terminalId);
  },

  getCurrentSession: (): AuthSession | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  logout: async (): Promise<void> => {
    const session = authService.getCurrentSession();
    if (session) {
      db.update('auditLogs', (logs) => [
        {
          id: `aud_${Date.now()}`,
          userId: session.user.id,
          userName: session.user.name,
          action: 'LOGOUT',
          entity: 'User',
          entityId: session.user.id,
          details: `User ${session.user.name} logged out from ${session.terminalId}`,
          terminalId: session.terminalId,
          timestamp: new Date().toISOString(),
        },
        ...logs,
      ]);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
  },

  getUsers: (): User[] => {
    return db.getSnapshot().users;
  },

  saveUser: (user: Partial<User> & { name: string; username: string; role: Role; pin: string }): User => {
    const data = db.getSnapshot();
    const existing = user.id ? data.users.find((u) => u.id === user.id) : null;

    let savedUser: User;
    if (existing) {
      savedUser = {
        ...existing,
        ...user,
      };
      db.update('users', (users) => users.map((u) => (u.id === existing.id ? savedUser : u)));
    } else {
      savedUser = {
        id: `usr_${Date.now()}`,
        name: user.name,
        username: user.username.toLowerCase(),
        role: user.role,
        pin: user.pin,
        active: user.active ?? true,
      };
      db.update('users', (users) => [...users, savedUser]);
    }

    return savedUser;
  },

  deleteUser: (userId: string): void => {
    db.update('users', (users) => users.filter((u) => u.id !== userId));
  },
};

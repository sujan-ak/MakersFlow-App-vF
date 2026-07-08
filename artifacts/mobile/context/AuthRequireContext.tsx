import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContextSupabase';
import { AuthPromptModal } from '@/components/AuthPromptModal';
import { useSegments, router } from 'expo-router';
import { PROTECTED_ROUTES } from '@/lib/protectedRoutes';

interface AuthRequireContextType {
  requireAuth: (action: () => void | Promise<void>) => void;
  showModal: () => void;
  hideModal: () => void;
}

const AuthRequireContext = createContext<AuthRequireContextType | null>(null);

export function AuthRequireProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const segments = useSegments();
  const [modalVisible, setModalVisible] = useState(false);
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);

  const requireAuth = useCallback((action: () => void | Promise<void>) => {
    if (user) {
      try {
        const res = action();
        if (res instanceof Promise) {
          res.catch(console.error);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      pendingActionRef.current = action;
      setModalVisible(true);
    }
  }, [user]);

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    pendingActionRef.current = null;
  }, []);

  const handleUserDismiss = useCallback(() => {
    setModalVisible(false);
    pendingActionRef.current = null;
    const currentPath = segments.join('/');
    const isProtectedRoute = PROTECTED_ROUTES.some((route) => {
      return (segments as any).includes(route) || currentPath.startsWith(route);
    });
    if (isProtectedRoute) {
      router.replace("/(tabs)");
    }
  }, [segments]);

  // Execute the pending action once authenticated
  useEffect(() => {
    const runPending = async () => {
      if (user && pendingActionRef.current) {
        try {
          await pendingActionRef.current();
        } catch (err) {
          console.error('[AuthRequire] Pending action error:', err);
        } finally {
          pendingActionRef.current = null;
          handleModalClose();
        }
      }
    };
    runPending();
  }, [user, handleModalClose]);

  const showModal = useCallback(() => setModalVisible(true), []);

  return (
    <AuthRequireContext.Provider
      value={{
        requireAuth,
        showModal,
        hideModal: handleUserDismiss,
      }}
    >
      {children}
      <AuthPromptModal
        visible={modalVisible}
        onClose={handleUserDismiss}
      />
    </AuthRequireContext.Provider>
  );
}

export function useRequireAuth() {
  const context = useContext(AuthRequireContext);
  if (!context) {
    throw new Error('useRequireAuth must be used within an AuthRequireProvider');
  }
  return context;
}

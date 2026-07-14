import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";

interface NetworkContextType {
  isConnected: boolean;
  addReconnectListener: (callback: () => void) => () => void;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const prevConnected = useRef<boolean>(true);
  const listeners = useRef<(() => void)[]>([]);

  const addReconnectListener = (callback: () => void) => {
    listeners.current.push(callback);
    return () => {
      listeners.current = listeners.current.filter((cb) => cb !== callback);
    };
  };

  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then((state) => {
      const connected = state.isConnected !== false;
      setIsConnected(connected);
      prevConnected.current = connected;
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected !== false;
      setIsConnected(connected);

      // Transition false -> true: emit reconnected events
      if (connected && !prevConnected.current) {
        listeners.current.forEach((cb) => {
          try {
            cb();
          } catch (e) {
            console.error('[NetworkContext] Listener error:', e);
          }
        });
      }
      prevConnected.current = connected;
    });

    return () => unsubscribe();
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, addReconnectListener }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }
  return context;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Product } from "@/data/mockData";

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "@makersflow_cart";
// Bump this number whenever the Product schema changes to invalidate stale caches.
const CART_VERSION = 2;

interface PersistedCart {
  version: number;
  items: CartItem[];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed: PersistedCart = JSON.parse(raw);
        // Only restore cart if the stored version matches the current schema version.
        // If the version is missing or outdated (i.e. stale mock data), discard it.
        if (parsed && parsed.version === CART_VERSION && Array.isArray(parsed.items)) {
          setItems(parsed.items);
        } else {
          // Stale / mock data — wipe it so checkout never shows old snapshots.
          AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        AsyncStorage.removeItem(STORAGE_KEY);
      }
    });
  }, []);

  function save(updated: CartItem[]) {
    setItems(updated);
    const payload: PersistedCart = { version: CART_VERSION, items: updated };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function addToCart(product: Product) {
    const existing = items.find((i) => i.product.id === product.id);
    if (existing) {
      save(items.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      save([...items, { product, quantity: 1 }]);
    }
  }

  function removeFromCart(productId: string) {
    save(items.filter((i) => i.product.id !== productId));
  }

  function clearCart() {
    save([]);
  }

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

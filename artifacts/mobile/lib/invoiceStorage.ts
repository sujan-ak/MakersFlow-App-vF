import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (orderId: string) => `invoice:${orderId}`;

export async function getInvoicePath(orderId: string): Promise<string | null> {
  return AsyncStorage.getItem(key(orderId));
}

export async function setInvoicePath(orderId: string, path: string): Promise<void> {
  await AsyncStorage.setItem(key(orderId), path);
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (lessonId: string) => `download:${lessonId}`;

export async function getDownloadedPath(lessonId: string): Promise<string | null> {
  return AsyncStorage.getItem(key(lessonId));
}

export async function setDownloadedPath(lessonId: string, path: string): Promise<void> {
  await AsyncStorage.setItem(key(lessonId), path);
}

export async function removeDownloadedPath(lessonId: string): Promise<void> {
  await AsyncStorage.removeItem(key(lessonId));
}

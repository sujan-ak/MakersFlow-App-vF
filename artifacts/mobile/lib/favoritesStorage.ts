import AsyncStorage from "@react-native-async-storage/async-storage";

export interface FavoriteCourse {
  courseId: string;
  courseTitle: string;
  courseThumbnail: any;
  category: string;
  price: number;
  isFree: boolean;
  savedAt: string;
}

export interface WatchLaterLesson {
  courseId: string;
  moduleId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  courseThumbnail: any;
  savedAt: string;
}

const STORAGE_KEYS = {
  favoriteCourses: (userId: string) => `@favorites_courses_${userId}`,
  watchLater: (userId: string) => `@watch_later_${userId}`,
  downloads: (userId: string) => `@downloads_${userId}`,
};

export const FavoritesStorage = {
  async loadFavoriteCourses(userId: string): Promise<FavoriteCourse[]> {
    try {
      const key = STORAGE_KEYS.favoriteCourses(userId);
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load favorite courses:", error);
      return [];
    }
  },

  async saveFavoriteCourses(
    userId: string,
    items: FavoriteCourse[]
  ): Promise<void> {
    try {
      const key = STORAGE_KEYS.favoriteCourses(userId);
      await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save favorite courses:", error);
    }
  },

  async loadWatchLater(userId: string): Promise<WatchLaterLesson[]> {
    try {
      const key = STORAGE_KEYS.watchLater(userId);
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load watch later lessons:", error);
      return [];
    }
  },

  async saveWatchLater(
    userId: string,
    items: WatchLaterLesson[]
  ): Promise<void> {
    try {
      const key = STORAGE_KEYS.watchLater(userId);
      await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save watch later lessons:", error);
    }
  },

  async loadDownloadedLessons(userId: string): Promise<WatchLaterLesson[]> {
    try {
      const key = STORAGE_KEYS.downloads(userId);
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load downloaded lessons:", error);
      return [];
    }
  },

  async saveDownloadedLessons(
    userId: string,
    items: WatchLaterLesson[]
  ): Promise<void> {
    try {
      const key = STORAGE_KEYS.downloads(userId);
      await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save downloaded lessons:", error);
    }
  },
};

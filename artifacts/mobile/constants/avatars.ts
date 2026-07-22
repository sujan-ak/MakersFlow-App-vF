import { ImageSourcePropType } from 'react-native';

export interface PresetAvatar {
  id: string;
  name: string;
  source: ImageSourcePropType;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'avatar-1', name: 'Felix', source: require('@/assets/images/avatars/avatar-1.png') },
  { id: 'avatar-2', name: 'Aria', source: require('@/assets/images/avatars/avatar-2.png') },
  { id: 'avatar-3', name: 'Leo', source: require('@/assets/images/avatars/avatar-3.png') },
  { id: 'avatar-4', name: 'Maya', source: require('@/assets/images/avatars/avatar-4.png') },
  { id: 'avatar-5', name: 'Sam', source: require('@/assets/images/avatars/avatar-5.png') },
  { id: 'avatar-6', name: 'Zoe', source: require('@/assets/images/avatars/avatar-6.png') },
  { id: 'avatar-7', name: 'Ethan', source: require('@/assets/images/avatars/avatar-7.png') },
  { id: 'avatar-8', name: 'Chloe', source: require('@/assets/images/avatars/avatar-8.png') },
  { id: 'avatar-9', name: 'Alex', source: require('@/assets/images/avatars/avatar-9.png') },
  { id: 'avatar-10', name: 'Nora', source: require('@/assets/images/avatars/avatar-10.png') },
  { id: 'avatar-11', name: 'Kai', source: require('@/assets/images/avatars/avatar-11.png') },
  { id: 'avatar-12', name: 'Sofia', source: require('@/assets/images/avatars/avatar-12.png') },
  { id: 'avatar-13', name: 'Sparky (Robot)', source: require('@/assets/images/avatars/avatar-13.png') },
  { id: 'avatar-14', name: 'Byte (Robo-Pet)', source: require('@/assets/images/avatars/avatar-14.png') },
];

export function getAvatarSource(avatarKeyOrUrl?: string | null): ImageSourcePropType | null {
  if (!avatarKeyOrUrl) return null;
  const found = PRESET_AVATARS.find((a) => a.id === avatarKeyOrUrl);
  if (found) return found.source;
  if (
    avatarKeyOrUrl.startsWith('http://') ||
    avatarKeyOrUrl.startsWith('https://') ||
    avatarKeyOrUrl.startsWith('data:')
  ) {
    return { uri: avatarKeyOrUrl };
  }
  return null;
}

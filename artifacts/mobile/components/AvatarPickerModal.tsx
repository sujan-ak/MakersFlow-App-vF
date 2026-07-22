import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { TEXT_STYLES } from '@/constants/typography';
import { PRESET_AVATARS, PresetAvatar } from '@/constants/avatars';

interface AvatarPickerModalProps {
  visible: boolean;
  selectedAvatarId: string | null;
  onSelectAvatar: (avatarId: string) => void;
  onClose: () => void;
}

export function AvatarPickerModal({
  visible,
  selectedAvatarId,
  onSelectAvatar,
  onClose,
}: AvatarPickerModalProps) {
  const colors = useColors();
  const [tempSelectedId, setTempSelectedId] = useState<string | null>(selectedAvatarId);

  useEffect(() => {
    setTempSelectedId(selectedAvatarId);
  }, [selectedAvatarId, visible]);

  const handleSelect = async (avatar: PresetAvatar) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempSelectedId(avatar.id);
  };

  const handleSave = async () => {
    if (tempSelectedId) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelectAvatar(tempSelectedId);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.title, TEXT_STYLES.pageTitle, { color: colors.foreground, fontSize: 18 }]}>
                Choose Avatar
              </Text>
              <Text style={[styles.subtitle, TEXT_STYLES.description, { color: colors.mutedForeground }]}>
                Select a profile illustration
              </Text>
            </View>
            <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Grid of avatars */}
          <ScrollView
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {PRESET_AVATARS.map((avatar) => {
              const isSelected = tempSelectedId === avatar.id;
              return (
                <Pressable
                  key={avatar.id}
                  style={({ pressed }) => [
                    styles.avatarWrapper,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => handleSelect(avatar)}
                >
                  <View
                    style={[
                      styles.avatarBorder,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected ? 3 : 1.5,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    <Image source={avatar.source} style={styles.avatarImage} />
                    {isSelected && (
                      <View style={[styles.checkmarkBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.avatarName,
                      TEXT_STYLES.label,
                      { color: isSelected ? colors.primary : colors.mutedForeground, fontSize: 11 },
                    ]}
                    numberOfLines={1}
                  >
                    {avatar.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, TEXT_STYLES.button, { color: '#FFF' }]}>
                Confirm Selection
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
    justifyContent: 'space-around',
  },
  avatarWrapper: {
    alignItems: 'center',
    width: 72,
  },
  avatarBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  checkmarkBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarName: {
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  saveBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

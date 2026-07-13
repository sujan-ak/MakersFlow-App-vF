import { Feather, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Application from 'expo-application';
import { TEXT_STYLES, TYPOGRAPHY } from '@/constants/typography';

// Lazy-load: this expo-media-library version needs the ExpoMediaLibraryNext
// native module, which Expo Go doesn't include — top-level import crashes.
function getMediaLibrary(): typeof import('expo-media-library') | null {
  if (Application.applicationId === 'host.exp.Exponent') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-media-library');
  } catch {
    return null;
  }
}
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export default function CertificateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { courseName, studentName, completionDate } = useLocalSearchParams<{
    courseName: string;
    studentName: string;
    completionDate: string;
  }>();
  const [isGenerating, setIsGenerating] = useState(false);

  const displayDate = completionDate
    ? new Date(completionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const getCertificateHtml = () => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Georgia, serif; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 40px; }
        .cert { width: 100%; max-width: 800px; border: 8px solid #4F46E5; border-radius: 16px; padding: 60px; text-align: center; position: relative; }
        .cert::before { content: ''; position: absolute; inset: 12px; border: 2px solid #C7D2FE; border-radius: 10px; pointer-events: none; }
        .brand { font-size: 13px; letter-spacing: 4px; color: #6366F1; font-family: Arial, sans-serif; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
        .title { font-size: 42px; color: #1E1B4B; margin: 16px 0 8px; }
        .subtitle { font-size: 14px; color: #6B7280; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 40px; }
        .presented { font-size: 14px; color: #9CA3AF; margin-bottom: 8px; }
        .student { font-size: 38px; color: #4F46E5; border-bottom: 2px solid #E0E7FF; padding-bottom: 12px; margin-bottom: 24px; }
        .completed { font-size: 14px; color: #6B7280; margin-bottom: 8px; }
        .course { font-size: 22px; color: #1F2937; font-weight: bold; margin-bottom: 40px; }
        .date { font-size: 13px; color: #9CA3AF; margin-top: 40px; }
        .footer { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 24px; border-top: 1px solid #E5E7EB; }
        .sig { text-align: center; }
        .sig-line { width: 140px; border-top: 1px solid #374151; margin: 0 auto 6px; }
        .sig-label { font-size: 11px; color: #6B7280; }
      </style>
    </head>
    <body>
      <div class="cert">
        <div class="brand">MakersFlow</div>
        <div class="title">Certificate</div>
        <div class="subtitle">of Completion</div>
        <div class="presented">This is to certify that</div>
        <div class="student">${studentName ?? 'Student'}</div>
        <div class="completed">has successfully completed the course</div>
        <div class="course">${courseName ?? 'Course'}</div>
        <div class="date">Issued on ${displayDate}</div>
        <div class="footer">
          <div class="sig"><div class="sig-line"></div><div class="sig-label">MakersFlow Team</div></div>
          <div class="sig"><div class="sig-line"></div><div class="sig-label">Date</div></div>
        </div>
      </div>
    </body>
    </html>
  `;

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(getCertificateHtml());
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 500);
        } else {
          Alert.alert('Popup Blocked', 'Please allow popups to save/print the certificate.');
        }
        return;
      }

      const dir = `${FileSystem.documentDirectory}certificates/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

      const { uri } = await Print.printToFileAsync({ html: getCertificateHtml(), base64: false });
      const dest = `${dir}certificate_${Date.now()}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: dest });

      if (Application.applicationId === 'host.exp.Exponent') {
        // Expo Go — skip MediaLibrary, use share only
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: 'Save Certificate' });
        } else {
          Alert.alert('Saved', `Certificate saved to:\n${dest}`);
        }
        setIsGenerating(false);
        return;
      }

      // MediaLibrary Permission Check (lazy — unavailable in Expo Go)
      const MediaLibrary = getMediaLibrary();
      if (!MediaLibrary) {
        // Expo Go fallback: share the PDF instead of saving to an album
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: 'Save Certificate' });
        } else {
          Alert.alert('Saved', `Certificate saved to:\n${dest}`);
        }
        setIsGenerating(false);
        return;
      }
      const { status: currentStatus, canAskAgain } = await MediaLibrary.getPermissionsAsync();
      let hasPermission = currentStatus === 'granted';

      if (!hasPermission && canAskAgain) {
        const { status: requestStatus } = await MediaLibrary.requestPermissionsAsync();
        hasPermission = requestStatus === 'granted';
      }

      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Media Library permission is required to save certificates. Please enable it in system settings.',
          [{ text: 'OK' }]
        );
        setIsGenerating(false);
        return;
      }

      try {
        const asset = await MediaLibrary.createAssetAsync(dest);
        const album = await MediaLibrary.getAlbumAsync('Certificates');
        if (album == null) {
          await MediaLibrary.createAlbumAsync('Certificates', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
        Alert.alert('Success', 'Certificate downloaded and saved to your device.');
      } catch (saveErr) {
        console.warn('[Certificate] MediaLibrary save failed, falling back to share:', saveErr);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: 'Save Certificate' });
        } else {
          Alert.alert('Saved', `Certificate saved to:\n${dest}`);
        }
      }
    } catch (e: any) {
      console.error('[Certificate] Download error:', e);
      Alert.alert('Error', 'Could not generate certificate PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, TEXT_STYLES.pageTitle, { color: colors.foreground, fontSize: 18 }]}>Certificate</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* Certificate card */}
        <View style={[styles.cert, { borderColor: colors.primary }]}>
          <View style={[styles.certInner, { borderColor: '#C7D2FE' }]}>
            <Text style={[styles.brand, TEXT_STYLES.label, { color: colors.primary }]}>MAKERSFLOW</Text>
            <Text style={[styles.certTitle, TEXT_STYLES.pageTitle, { color: colors.foreground, fontSize: 32 }]}>Certificate</Text>
            <Text style={[styles.certSubtitle, TEXT_STYLES.label, { color: colors.mutedForeground, letterSpacing: 3 }]}>OF COMPLETION</Text>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={[styles.presented, TEXT_STYLES.description, { color: colors.mutedForeground }]}>This is to certify that</Text>
            <Text style={[styles.studentName, TEXT_STYLES.pageTitle, { color: colors.primary, fontSize: 28 }]}>{studentName ?? 'Student'}</Text>

            <Text style={[styles.completed, TEXT_STYLES.description, { color: colors.mutedForeground }]}>has successfully completed</Text>
            <Text style={[styles.courseName, TEXT_STYLES.cardTitle, { color: colors.foreground, fontSize: 18 }]}>{courseName ?? 'Course'}</Text>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.awardRow}>
              <Feather name="award" size={20} color="#F59E0B" />
              <Text style={[styles.dateText, TEXT_STYLES.meta, { color: colors.mutedForeground }]}>{displayDate}</Text>
            </View>

            <Text style={[styles.footerBrand, TYPOGRAPHY.caption, { color: colors.mutedForeground }]}>MakersFlow · Learn · Explore · Excel</Text>
          </View>
        </View>

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.btn, { flex: 1, backgroundColor: colors.primary, opacity: isGenerating ? 0.7 : 1 }]}
            onPress={handleDownload}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={[styles.btnText, TEXT_STYLES.button, { color: "#FFF", fontSize: 14 }]}>Download PDF</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.shareBtn, { borderColor: colors.primary }]}
            onPress={async () => {
              if (Platform.OS === 'web') {
                Alert.alert("Share", "Sharing is not supported on web. Please download the PDF.");
                return;
              }
              try {
                // Generate PDF URI first, then share
                const { uri } = await Print.printToFileAsync({ html: getCertificateHtml() });
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Certificate' });
                } else {
                  Alert.alert('Saved', 'Sharing is not available. PDF generated successfully.');
                }
              } catch (err) {
                console.error("[Certificate] Share error:", err);
                Alert.alert("Error", "Could not share certificate.");
              }
            }}
          >
            <Ionicons name="share-social" size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.shareBtnText, TEXT_STYLES.button, { color: colors.primary, fontSize: 14 }]}>Share</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 20 },
  cert: { borderWidth: 6, borderRadius: 16, padding: 4 },
  certInner: { borderWidth: 1.5, borderRadius: 12, padding: 28, alignItems: 'center', gap: 10 },
  brand: { fontSize: 11, letterSpacing: 4, fontWeight: '800' },
  certTitle: { fontSize: 32, fontWeight: '800' },
  certSubtitle: { fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  divider: { width: '60%', height: 1, marginVertical: 4 },
  presented: { fontSize: 13 },
  studentName: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  completed: { fontSize: 13 },
  courseName: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  awardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dateText: { fontSize: 13 },
  footerBrand: { fontSize: 11, marginTop: 8 },
  actionsRow: { flexDirection: "row", gap: 12, marginTop: 16, width: "100%" },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 24, height: 48 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1.5, backgroundColor: '#FFFFFF', height: 48, flex: 1 },
  shareBtnText: { fontSize: 16, fontWeight: '700' },
});

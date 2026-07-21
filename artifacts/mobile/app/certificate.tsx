import { Feather, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import { TEXT_STYLES, TYPOGRAPHY } from '@/constants/typography';

// Lazy-load: this expo-media-library version needs the ExpoMediaLibraryNext
// native module, which Expo Go doesn't include — top-level import crashes.
function getMediaLibrary(): typeof import('expo-media-library') | null {
  // Use Constants.appOwnership for reliable Expo Go detection in built APKs
  const isExpoGo = (Constants as any).appOwnership === 'expo'
    || Application.applicationId === 'host.exp.Exponent';
  if (isExpoGo) return null;
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

const TRANSPARENT_1X1_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function getCertificateHtml(
  studentName: string,
  courseName: string,
  daysCompleted: string,
  displayDate: string
) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Certificate</title>
      <style>
        *{
          margin:0;
          padding:0;
          box-sizing:border-box;
          font-family:Arial,sans-serif;
        }
        body{
          background:#f0f6f8;
          display:flex;
          justify-content:center;
          align-items:center;
          padding:30px;
        }
        .certificate{
          width:297mm;
          height:210mm;
          background:linear-gradient(135deg,#dffcff,#ffffff);
          padding:45px;
          position:relative;
          overflow:hidden;
          border-radius:8px;
        }
        .certificate::before{
          content:"";
          position:absolute;
          top:-120px;
          right:-120px;
          width:350px;
          height:350px;
          background:#78dce8;
          border-radius:50%;
          opacity:.35;
        }
        .certificate::after{
          content:"";
          position:absolute;
          left:-150px;
          bottom:-150px;
          width:320px;
          height:320px;
          background:#32cfe0;
          transform:rotate(45deg);
          opacity:.25;
        }
        .top{
          display:flex;
          justify-content:space-between;
          align-items:center;
        }
        .logo{
          max-height:70px;
          width:auto;
          object-fit:contain;
        }
        h1{
          text-align:center;
          margin-top:35px;
          font-size:56px;
          color:#1b4b8f;
          letter-spacing:3px;
        }
        h3{
          text-align:center;
          color:#5b79b8;
          margin-bottom:25px;
        }
        .name{
          text-align:center;
          font-size:42px;
          color:#124a9f;
          border-bottom:2px solid #4e87c8;
          display:inline-block;
          width:70%;
          margin:18px auto;
          padding-bottom:10px;
        }
        p{
          text-align:center;
          color:#555;
          margin-top:12px;
        }
        .title{
          text-align:center;
          margin-top:18px;
          font-size:34px;
          color:#1d5db3;
        }
        .desc{
          width:80%;
          margin:18px auto;
          line-height:1.7;
          font-size:16px;
        }
        .date{
          margin-top:20px;
          font-size:16px;
          font-weight:bold;
          color:#1b4b8f;
        }
        .bottom{
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          margin-top:90px;
        }
        .line{
          width:220px;
          border-top:2px solid #444;
          margin-bottom:10px;
        }
        .badge{
          height:110px;
          filter:drop-shadow(0 8px 18px rgba(0,0,0,.18));
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="top">
          <img src="{{FLOW_LOGO}}" class="logo">
          <img src="{{EDODWAJA_LOGO}}" class="logo">
        </div>
        <h1>CERTIFICATE</h1>
        <h3>OF PARTICIPATION</h3>
        <p>Presented to</p>
        <h2 class="name">${studentName}</h2>
        <p>for successfully completing <b>${daysCompleted}</b> days of participation in</p>
        <h2 class="title">${courseName}</h2>
        <h4>"Learn by Doing – Future Tech Explorers"</h4>
        <p class="desc">
          and actively engaging in hands-on learning experiences in Robotics,
          Electronics,
          Automation,
          Virtual Reality (VR),
          Augmented Reality (AR),
          3D Printing,
          Artificial Intelligence,
          and Emerging Technologies through the FLOW BUS initiative.
        </p>
        <p class="date">Issued on ${displayDate}</p>
        <div class="bottom">
          <div>
            <div class="line"></div>
            <h4>The FLOW BUS</h4>
            <p>FLOW BUS</p>
          </div>
          <img src="{{BADGE_IMAGE}}" class="badge">
          <div>
            <div class="line"></div>
            <h4>Madhulash Babu</h4>
            <p>Founder & CEO</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default function CertificateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { courseName, studentName, completionDate, daysCompleted } = useLocalSearchParams<{
    courseName: string;
    studentName: string;
    completionDate: string;
    daysCompleted?: string;
  }>();
  const [isGenerating, setIsGenerating] = useState(false);

  let displayDate = 'N/A';
  try {
    const d = completionDate ? new Date(completionDate) : new Date();
    if (!isNaN(d.getTime())) {
      displayDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  } catch (err) {
    console.warn('[Certificate] Invalid completion date:', err);
  }

  const generateHtmlWithImages = async () => {
    let flowLogoBase64 = TRANSPARENT_1X1_PNG;
    let edodwajaLogoBase64 = TRANSPARENT_1X1_PNG;
    let badgeBase64 = TRANSPARENT_1X1_PNG;

    try {
      if (Platform.OS !== 'web') {
        const resolveBase64 = async (module: any) => {
          try {
            const asset = Asset.fromModule(module);
            await asset.downloadAsync();
            const uri = asset.localUri || asset.uri;
            if (uri) {
              const base64Data = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const extension = uri.split('.').pop()?.toLowerCase() || 'png';
              const mime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'image/png';
              return `data:${mime};base64,${base64Data}`;
            }
          } catch (err) {
            console.warn('[Certificate] Error resolving asset base64:', err);
          }
          return TRANSPARENT_1X1_PNG;
        };

        flowLogoBase64 = await resolveBase64(require('@/assets/images/certificates/flow_logo.webp'));
        edodwajaLogoBase64 = await resolveBase64(require('@/assets/images/certificates/edodwaja_logo.webp'));
        badgeBase64 = await resolveBase64(require('@/assets/images/certificates/badge.webp'));
      } else {
        flowLogoBase64 = 'https://oodqutwsljhvuyotuthu.supabase.co/storage/v1/object/public/partners/Flow%20Logo%20Gradient-%20v2.png';
        edodwajaLogoBase64 = 'https://oodqutwsljhvuyotuthu.supabase.co/storage/v1/object/public/partners/Ed-Logo-.jpg';
        badgeBase64 = 'https://via.placeholder.com/150';
      }
    } catch (e) {
      console.error('[Certificate] Asset loading failed:', e);
    }

    const html = getCertificateHtml(
      studentName ?? 'Student',
      courseName ?? 'Course',
      daysCompleted ?? 'N/A',
      displayDate
    );
    return html
      .replace('{{FLOW_LOGO}}', flowLogoBase64)
      .replace('{{EDODWAJA_LOGO}}', edodwajaLogoBase64)
      .replace('{{BADGE_IMAGE}}', badgeBase64);
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const html = await generateHtmlWithImages();
          printWindow.document.write(html);
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

      const htmlContent = await generateHtmlWithImages();
      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
      const dest = `${dir}certificate_${Date.now()}.pdf`;
      await FileSystem.moveAsync({ from: uri, to: dest });

      // ── Save the PDF somewhere the user can actually find it ─────────────
      // MediaLibrary is deliberately NOT used here. It only accepts images and
      // video, so createAssetAsync() throws "Unsupported file type" on a PDF —
      // that failure is what made the old code fall through to the share sheet,
      // and requesting its permission is what triggered the music/audio prompt.
      //
      // Android: Storage Access Framework — the user picks a folder (Downloads)
      //          and the file is written there, visible in any file manager.
      // iOS:     the share sheet is the platform-native "Save to Files" path.
      if (Platform.OS === 'android') {
        try {
          const SAF = (FileSystem as any).StorageAccessFramework;
          const perm = await SAF.requestDirectoryPermissionsAsync();

          if (!perm.granted) {
            Alert.alert('Save Cancelled', 'No folder was chosen, so the certificate was not saved.', [{ text: 'OK' }]);
            setIsGenerating(false);
            return;
          }

          const base64 = await FileSystem.readAsStringAsync(dest, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const fileName = `MakersFlow_Certificate_${Date.now()}`;
          const newUri = await SAF.createFileAsync(perm.directoryUri, fileName, 'application/pdf');
          await FileSystem.writeAsStringAsync(newUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          Alert.alert('✅ Downloaded!', 'Certificate saved to the folder you chose.', [{ text: 'OK' }]);
        } catch (safErr) {
          console.warn('[Certificate] SAF save failed:', safErr);
          Alert.alert('Could Not Save', 'Saving to that folder failed. Use the Share button to save it elsewhere.', [{ text: 'OK' }]);
        }
        setIsGenerating(false);
        return;
      }

      // iOS
      const canShareIos = await Sharing.isAvailableAsync();
      if (canShareIos) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Certificate',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('✅ Saved!', 'Certificate generated successfully.', [{ text: 'OK' }]);
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
        <View style={[styles.cert, { borderColor: '#00BCD4' }]}>
          <View style={[styles.certInner, { borderColor: '#C7D2FE' }]}>
            <Text style={[styles.brand, TEXT_STYLES.label, { color: '#00BCD4' }]}>MAKERSFLOW</Text>
            <Text style={[styles.certTitle, TEXT_STYLES.pageTitle, { color: '#1a2a3a', fontSize: 32 }]}>Certificate</Text>
            <Text style={[styles.certSubtitle, TEXT_STYLES.label, { color: '#6B7280', letterSpacing: 3 }]}>OF COMPLETION</Text>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={[styles.presented, TEXT_STYLES.description, { color: colors.mutedForeground }]}>This is to certify that</Text>
            <Text style={[styles.studentName, TEXT_STYLES.pageTitle, { color: '#0B6FAD', fontSize: 28 }]}>{studentName ?? 'Student'}</Text>

            <Text style={[styles.completed, TEXT_STYLES.description, { color: colors.mutedForeground }]}>has successfully completed</Text>
            <Text style={[styles.courseName, TEXT_STYLES.cardTitle, { color: colors.foreground, fontSize: 18 }]}>{courseName ?? 'Course'}</Text>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.awardRow}>
              <Feather name="award" size={20} color="#FF6B00" />
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
                const htmlContent = await generateHtmlWithImages();
                const { uri } = await Print.printToFileAsync({ html: htmlContent });
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

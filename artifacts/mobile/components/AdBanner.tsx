/**
 * AdBanner — Google AdMob Banner Component
 *
 * ══════════════════════════════════════════════════════════════════
 * STATUS: MOCK (iklan palsu) — lihat panduan di bawah untuk aktifkan
 * ══════════════════════════════════════════════════════════════════
 *
 * CARA AKTIFKAN IKLAN NYATA (4 Langkah):
 *
 * LANGKAH 1 — Daftar & Setup AdMob Console
 *   → Buka https://admob.google.com
 *   → Login dengan Google Account
 *   → Klik "Tambahkan Aplikasi" → pilih Android atau iOS
 *   → Isi nama app & store (Google Play / App Store)
 *   → Salin "ID Aplikasi" (format: ca-app-pub-XXXXXXXX~XXXXXXXXXX)
 *
 * LANGKAH 2 — Buat Ad Unit (Banner)
 *   → Di sidebar klik "Unit Iklan" → "Tambah Unit Iklan"
 *   → Pilih tipe "Banner"
 *   → Salin "ID Unit Iklan" (format: ca-app-pub-XXXXXXXX/XXXXXXXXXX)
 *
 * LANGKAH 3 — Isi ID di app.json
 *   Di app.json, tambahkan/ganti bagian ini:
 *
 *   "plugins": [
 *     ...,
 *     ["react-native-google-mobile-ads", {
 *       "androidAppId": "ca-app-pub-XXXXXXXX~XXXXXXXXXX",   ← App ID Android
 *       "iosAppId": "ca-app-pub-XXXXXXXX~XXXXXXXXXX"        ← App ID iOS
 *     }]
 *   ]
 *
 *   Dan tambahkan di .env atau Replit Secrets:
 *     EXPO_PUBLIC_ADMOB_BANNER_ANDROID=ca-app-pub-XXXXXXXX/XXXXXXXXXX
 *     EXPO_PUBLIC_ADMOB_BANNER_IOS=ca-app-pub-XXXXXXXX/XXXXXXXXXX
 *
 * LANGKAH 4 — Aktifkan kode nyata di bawah
 *   1. Install package:
 *      pnpm --filter @workspace/mobile add react-native-google-mobile-ads
 *   2. Uncomment blok "PRODUCTION CODE" di bawah
 *   3. Comment blok "MOCK CODE" di bawah
 *   4. Build ulang dengan EAS: eas build --platform android
 *
 * CATATAN PENTING:
 *   • Iklan TIDAK bisa tampil di Expo Go — harus EAS Build / APK
 *   • Gunakan TestIds.BANNER saat __DEV__ agar tidak melanggar kebijakan AdMob
 *   • Proses review AdMob bisa 1–7 hari setelah app tayang di store
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

// ─── ID Unit Iklan ────────────────────────────────────────────────────────────
// Isi setelah dapat dari AdMob Console (Langkah 2)
const BANNER_ANDROID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? "";
const BANNER_IOS     = process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? "";
const BANNER_UNIT_ID = Platform.OS === "ios" ? BANNER_IOS : BANNER_ANDROID;

// Set true kalau sudah install react-native-google-mobile-ads & dapat ID
const ADS_ENABLED = false;

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION CODE (uncomment saat ADS_ENABLED = true)
// ─────────────────────────────────────────────────────────────────────────────
//
// import {
//   BannerAd,
//   BannerAdSize,
//   TestIds,
// } from "react-native-google-mobile-ads";
//
// const adUnitId = __DEV__ ? TestIds.BANNER : BANNER_UNIT_ID;
//
// function RealBannerAd() {
//   return (
//     <BannerAd
//       unitId={adUnitId}
//       size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
//       requestOptions={{ requestNonPersonalizedAdsOnly: true }}
//     />
//   );
// }
//
// ─────────────────────────────────────────────────────────────────────────────
// MOCK CODE (hapus/comment saat sudah pakai production code)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ADS = [
  { label: "Belajar lebih cepat dengan AI", cta: "Coba Gratis", color: "#4C6FFF" },
  { label: "Flashcard & Quiz tersedia 24/7", cta: "Mulai Sekarang", color: "#7C3AED" },
  { label: "Raih target belajarmu hari ini", cta: "Lihat Tips", color: "#059669" },
];

function MockBannerAd({ size = "banner" }: { size?: string }) {
  const [adIndex, setAdIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAdIndex((i) => (i + 1) % MOCK_ADS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  if (dismissed) return null;

  const ad = MOCK_ADS[adIndex];
  const bannerHeight = size === "banner" ? 50 : size === "largeBanner" ? 100 : 250;

  return (
    <View style={[styles.container, { height: bannerHeight }, size === "mediumRectangle" && styles.mrec]}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Ad</Text>
      </View>
      <View style={styles.content}>
        <Feather name="zap" size={14} color={ad.color} style={{ marginRight: 6 }} />
        <Text style={styles.adText} numberOfLines={1}>{ad.label}</Text>
      </View>
      <TouchableOpacity style={[styles.ctaBtn, { borderColor: ad.color }]} activeOpacity={0.75}>
        <Text style={[styles.ctaText, { color: ad.color }]}>{ad.cta}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.dismissBtn}
        activeOpacity={0.7}
      >
        <Feather name="x" size={12} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export utama — otomatis beralih antara mock dan real
// ─────────────────────────────────────────────────────────────────────────────

interface AdBannerProps {
  size?: "banner" | "largeBanner" | "mediumRectangle";
  style?: object;
}

export function AdBanner({ size = "banner", style }: AdBannerProps) {
  // Web tidak mendukung AdMob
  if (Platform.OS === "web") return null;

  // Kalau ADS_ENABLED = true dan ada ID → pakai iklan nyata
  // if (ADS_ENABLED && BANNER_UNIT_ID) return <RealBannerAd />;

  // Default: tampilkan mock
  return (
    <View style={style}>
      <MockBannerAd size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    width: "100%",
  },
  mrec: {
    flexDirection: "column",
    justifyContent: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderTopWidth: 1,
  },
  badge: {
    backgroundColor: "#F0F4FF",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  adText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark,
    flex: 1,
  },
  ctaBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dismissBtn: {
    padding: 2,
    marginLeft: 2,
  },
});

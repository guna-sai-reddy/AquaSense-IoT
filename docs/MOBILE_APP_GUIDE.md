# AquaSense-IoT Mobile Application Guide

This guide details the mobile application architecture, native Android packaging, mobile user interface, and build instructions for **AquaSense-IoT**.

---

## 1. Mobile Architecture Overview

AquaSense-IoT provides two mobile distribution methods:

1. **Native Mobile App (Capacitor + Android / iOS):**
   - Packaged as an Android native application located in [`frontend/android/`](file:///d:/Assignment/project/frontend/android).
   - Package Identifier: `org.aquasense.iot`.
   - Native Device Permissions configured in [`AndroidManifest.xml`](file:///d:/Assignment/project/frontend/android/app/src/main/AndroidManifest.xml):
     - `INTERNET`: Real-time backend REST communication & weather updates.
     - `ACCESS_NETWORK_STATE`: LoRaWAN, cellular, and Wi-Fi IoT gateway status.
     - `ACCESS_FINE_LOCATION` & `ACCESS_COARSE_LOCATION`: GPS field coordinate mapping.
     - `CAMERA`: In-field crop condition photo capture.
   - Pre-generated launcher icons across all screen densities:
     - `mipmap-mdpi` ($48\times 48$)
     - `mipmap-hdpi` ($72\times 72$)
     - `mipmap-xhdpi` ($96\times 96$)
     - `mipmap-xxhdpi` ($144\times 144$)
     - `mipmap-xxxhdpi` ($192\times 192$)

2. **Progressive Web App (PWA):**
   - Installable directly from the mobile browser onto iOS (Safari) and Android (Chrome) without App Store submission.
   - Standalone fullscreen display mode without browser URL bars.
   - Offline service worker caching (`/sw.js`) and web manifest (`/manifest.json`).

---

## 2. Native Mobile UI & UX Optimizations

* **Mobile Bottom Navigation Bar (Tab Bar):**
  - Displays automatically on mobile screens (`< 768px`).
  - Provides instant one-thumb navigation:
    1. 🏠 **Overview (`/`)**
    2. 🌾 **Fields (`/fields`)**
    3. 💧 **Soil Moisture (`/soil-moisture`)**
    4. 🧭 **Irrigation Advisory (`/irrigation`)**
    5. ☀️ **Weather & ET₀ (`/weather`)**
    6. ☰ **Menu (Drawer)**
* **Safe Area Insets:**
  - Content padded with `safe-area-pb` to account for notched phones and mobile home indicator bars.
* **Touch & Haptic Styling:**
  - `-webkit-tap-highlight-color: transparent`
  - `touch-action: manipulation` for rapid tap responsiveness.

---

## 3. How to Run & Build the Mobile App

### Prerequisites
- Node.js 20+ & npm
- Java JDK 17+ (JDK 24 is already installed on your system)
- Android Studio (optional, for visual emulation and Play Store release bundling)

### Step 1: Synchronize Mobile Project
```bash
cd frontend
npm run mobile:sync
```

### Step 2: Open in Android Studio
To launch the native Android project in Android Studio:
```bash
npx cap open android
```
From Android Studio, click **Run** (Green Play Button) to launch on an Android Emulator or connected physical phone over USB.

### Step 3: Build Android APK via Command Line
To build the `.apk` without opening Android Studio:
```bash
cd frontend/android
./gradlew assembleDebug
```
The compiled debug APK will be generated at:
```
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. Mobile Configuration File
Capacitor configuration is defined in [`frontend/capacitor.config.ts`](file:///d:/Assignment/project/frontend/capacitor.config.ts):
```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.aquasense.iot",
  appName: "AquaSense-IoT",
  webDir: "public",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0f172a",
      showSpinner: false,
    },
  },
};

export default config;
```

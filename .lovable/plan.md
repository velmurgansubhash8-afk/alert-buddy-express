

# Converting to Native Mobile App with Background Push Notifications

Your app already has Capacitor configured and OneSignal integrated. Here is a step-by-step guide to build and run the native app with real push notifications that appear in the notification bar even when the app is closed.

## What You Need

- A **Mac with Xcode** (for iOS) or **Android Studio** (for Android)
- Your **OneSignal Dashboard** configured with platform credentials (FCM for Android, APNs for iOS)
- The project exported to **GitHub**

## Step-by-Step Process

### Step 1: Configure OneSignal for Native Platforms

In your **OneSignal Dashboard** (onesignal.com):

**For Android:**
1. Go to Settings → Platforms → Google Android
2. Enter your **Firebase Server Key** (from Firebase Console → Project Settings → Cloud Messaging)
3. This enables background notifications on Android

**For iOS:**
1. Go to Settings → Platforms → Apple iOS
2. Upload your **APNs Authentication Key (.p8 file)** from Apple Developer Console
3. Enter your Team ID and Key ID
4. This enables background notifications on iOS

### Step 2: Export and Set Up Locally

1. Click **"Export to GitHub"** in Lovable
2. Clone the repo to your computer:
   ```
   git clone <your-repo-url>
   cd <project-folder>
   ```
3. Install dependencies:
   ```
   npm install
   ```

### Step 3: Add Native Platforms

```bash
npx cap add android    # For Android
npx cap add ios        # For iOS
```

### Step 4: Install OneSignal Native SDK

```bash
npm install onesignal-cordova-plugin
npx cap sync
```

For Android, add to `android/app/build.gradle`:
```gradle
plugins {
    id 'com.onesignal.androidsdk.onesignal-gradle-plugin'
}
```

For iOS, OneSignal requires adding the **Notification Service Extension** in Xcode for rich notifications and reliable background delivery.

### Step 5: Build and Run

```bash
npm run build
npx cap sync
npx cap run android   # or: npx cap run ios
```

### Step 6: Test Notifications

1. Open the app on your device and log in
2. Enable push notifications when prompted
3. From another device/account, trigger an emergency alert
4. You should see the notification in the system notification bar, even with the app closed

## Code Changes I Will Make

1. **Add OneSignal Capacitor plugin** (`@onesignal/onesignal-capacitor`) to `package.json`
2. **Update `usePushNotifications.tsx`** to use the OneSignal native SDK instead of Capacitor's generic push API — this ensures notifications work in background/killed state
3. **Update `capacitor.config.ts`** with OneSignal plugin configuration
4. **Remove the old FCM-based push code** that conflicts with OneSignal

## Why This Works for Background Notifications

OneSignal's native SDK handles all background notification delivery automatically through:
- **Android**: Firebase Cloud Messaging with a persistent service
- **iOS**: APNs with proper background modes and Notification Service Extension

No custom background service code is needed — OneSignal handles it natively.

## Important Notes

- The web version of your app will continue to use OneSignal's web SDK (already set up)
- The native app will use OneSignal's native SDK for reliable background delivery
- Both share the same OneSignal App ID and player subscriptions
- Read the full Capacitor setup guide: https://docs.lovable.dev/tips-tricks/mobile-development


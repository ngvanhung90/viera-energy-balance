# Viera Energy Balance

Viera helps adults turn a dinner idea into an evening plan. Search Asian and European dishes by name or ingredient, or sort by an estimated plate-energy target. Scale servings, check off ingredients, follow the written recipe or a linked cooking video, and open a store route in Maps. Add the selected meal and a movement routine, then save the pairing on the device. The coach also offers pairings to review and save. Favorites and weight-goal habit plans stay on the device.

## Android

The Android app lives in `android/` and packages the same UI and recipe content. It uses the native Firebase Android SDK from `NativeCoach.kt` via an origin-scoped WebView message channel. The HTML served in an ordinary phone browser uses the web adapter instead.

The source targets API 35, compiles with Android SDK 36 and Build Tools 35.0.0, and uses JDK 17, Gradle 8.13, Android Gradle Plugin 8.13.2, Kotlin 2.4.21 and D8/R8 9.1.29. The on-device SDK pulls in ML Kit classes with Kotlin 2.4 metadata. Point your local environment to an installed SDK and use the approved Android build producer for your machine. With those dependencies and an authorized build environment, run `gradle :app:assembleDebug` from `android/`.

### Judge quick start

1. On Android 8.0 (API 26) or newer, install the provided review APK. From **Meals**, open **Crispy tofu soba**, choose 1½ servings and check off an ingredient. Follow the written steps, select a movement routine, and tap **Save my plan**. The Ho Chi Minh City directory, route links, and technique videos are available in recipe details. Maps and video playback need a connection.
2. In **Plan**, select **Gemini Cloud demo only**, allow the synthetic demo request for this session, and tap **Suggest a plan**. A review APK with working App Check and a verified Spark project is required. Open **Execution details** for the Gemini Cloud label and model. The SDK must return `IN_CLOUD` for this label to appear.
3. On a supported device with AICore and the Firebase AI Logic Nano 4 Fast preview ready, select **Gemini Nano only**, leave cloud consent off, and tap **Suggest a plan**. **Execution details** shows the Gemini Nano label and model when the SDK reports `ON_DEVICE`. On an unsupported device, **Offline Rules** can still suggest a pairing.

The current 0.1.1 QA APK was verified on OPPO A57 for the local catalog, saved plan and consent behavior. It has no Firebase project config. The Firebase-enabled Android review APK and both Gemini runtime results are pending. The OPPO A57 has no AICore.

### Gemini Live on Android

Open a recipe and choose **Call Gemini to cook**, or choose **Call Gemini to work out** from Movement. The native call screen shows the selected model, connection state, and controls for microphone, camera, pause, resume and end. The fitness setup remembers your workout selections on this device. Cooking sends the selected catalog recipe. The demo workout instruction uses activity, duration, effort, equipment, an approximate energy target and a generic movement format. The optional gender selection stays on the device. Comfort or movement-limit settings can lower the requested effort or select a format such as low-impact or chair-based. The outgoing prompt contains no demographics or medical history.

The start button requires per-call consent. The microphone requires Android permission and the camera starts only after the separate **Share camera** action and Android permission. Frames are sampled in memory, approximately once a second. Leaving the call or backgrounding the app stops both inputs. Viera stores no voice, camera recordings or captions. Google may use content shared with Gemini Free tier to improve its services. Use sample ingredients and non-identifying demonstration movements for QA. [Gemini API terms](https://ai.google.dev/gemini-api/terms)

The native integration calls Firebase AI Logic `liveModel` through Gemini Developer API using `gemini-3.1-flash-live-preview`. Enable `liveFreeTierVerified` in the private Firebase config only after checking Live quota, App Check enforcement and Spark without billing for `viera-energy-balance`. The Live SDK session supports a user-initiated resume attempt. If the session cannot resume, the app asks the user to start a new call. Live QA requires a real spoken follow-up and an audible response based on a consented camera frame for each coach. The Live call is a cloud feature. Verify the planner's `IN_CLOUD` and `ON_DEVICE` results independently. [Firebase Live](https://firebase.google.com/docs/ai-logic/live-api) · [Android quickstart](https://github.com/firebase/quickstart-android/tree/master/firebase-ai/app/src/main/java/com/google/firebase/quickstart/ai/feature/live)

## Run the web app

Use Node.js 22 or newer. The app has no package install step.

```sh
npm test
npm start
```

Open `http://127.0.0.1:4173`. For hosting, serve `public/` on HTTPS. After the first complete load, the service worker caches the application, recipes, images and Firebase SDK modules.

## Set up a zero-spend Firebase project

1. Use a dedicated Firebase project. In Firebase and Cloud consoles verify **Spark** and **no linked Cloud Billing**. Confirm availability of the Gemini Developer API free tier for that project and verify its current limits. Leave these settings in effect for the judging period.
2. In **AI Services → AI Logic**, initialize the **Gemini Developer API** provider. Register the appropriate Web or Android app. For Android use `com.vieralabs.energybalance`. Use the Firebase app configuration, without a separate Gemini API key.
3. Keep App Check enforcement enabled. For a hosted Web app use an App Check reCAPTCHA Enterprise score-based site key tied to its actual HTTPS host. For Android release builds use Play Integrity and register the release signing fingerprint for the supported distribution channel. On a controlled debug build use Firebase’s App Check debug provider. Register that environment’s debug token privately in Firebase, with App Check still enforced. Keep debug tokens and project configuration outside this repository.
4. For Web, copy `public/firebase-config.example.json` to the ignored `public/firebase-config.json` and fill in the Firebase web config. On localhost only, set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in the browser’s private development console before the first cloud run when using debug attestation. Read and register the emitted token locally. For hosted Web set the public reCAPTCHA site key in the config file. For Android, copy `android/viera-native-config.example.json` to the ignored `android/app/attestation/viera-native-config.json` and use the registered Android app’s config.
5. Set `sparkBillingVerified` to `true` only after confirming Step 1 for that project. Cloud calls are also gated by consent and App Check token acquisition. The app uses `gemini-3.5-flash-lite` and applies a cooldown after quota errors.

## Verify the execution paths

| Path | Reproduce with synthetic preferences | Evidence to capture |
| --- | --- | --- |
| On-device | On an Android Nano 4 test device with AICore and the applicable Fast preview model ready, choose **Gemini Nano only** and build a plan. If a local device can be verified offline, disable connectivity in the authorized QA setup. Preserve the control connection on streamed devices. | SDK `ON_DEVICE`, resulting pair, AICore/model version, and no cloud inference during the run. |
| Cloud | On the reviewed Spark project, enable synthetic prompt sharing, choose **Gemini Cloud demo only**, and build a plan. | SDK `IN_CLOUD`, selected model and returned pair, a successful Firebase AI Logic proxy request and verified App Check count. |
| App Check | Keep enforcement enabled. Compare the attested APK request with one synthetic request from an isolated Firebase AI Logic SDK QA client that has no App Check provider. The APK blocks token acquisition failures locally, so its fallback alone cannot show a proxy rejection. | Sanitized verified success and server rejection, plus enforcement and Spark plan read-back. Keep request headers and tokens private. |
| Fallback | Try an unsupported device, an offline or slow connection, and a quota rejection in a bounded test. | A clear reason and a usable catalog result for each. For quota handling use a controlled test response for client UI coverage and distinguish it from live service evidence. |

The app checks model readiness before SDK initialization. It leaves model download to the permitted test environment and requires an actual recorded model result for the inference badge. The Android implementation requests the Nano 4 Fast preview and checks the reported `nano-v4` model name. The web implementation uses the official Firebase JS 13.4.0 SDK via `getAI`, `getGenerativeModel`, `initializeDeviceModel` and `generateContent`. The Android implementation uses Firebase AI Logic 18.2.0 and Firebase AI Logic On-Device 16.0.0-beta08 and calls `generateContent` natively.

For Android Device Streaming, check the project-specific catalog and remaining Spark minutes before reserving a device. Confirm how its AICore Developer Preview and the model will be prepared. A model listed in the public device catalog can still require preview enrollment or a download. [Device Streaming catalog command](https://developer.android.com/tools/agents/android-cli/commands/device_remote_models) · [AICore Developer Preview](https://developers.google.com/ml-kit/genai/aicore-dev-preview)

Use the debug provider only for controlled QA. For an independently usable review APK, verify a signed release on a clean installation with the supported Play Integrity settings for its distribution channel and App Check still enforced. If Firebase AI Logic replay protection is enforced on the project, the client must use limited-use tokens. [Play Integrity setup](https://firebase.google.com/docs/app-check/android/play-integrity-provider) · [App Check replay protection](https://firebase.google.com/docs/ai-logic/app-check#replay-protection)

Both platforms use explicit device-only and cloud-only SDK branches so private preferences and weight goals never enter a cloud fallback. The cloud prompt uses a sample preference profile, catalog choices and the selected demo filters. The model picks a recipe and activity from an approved set and returns structured IDs. The app rejects invalid IDs or results with an unexpected execution source. Nutrition, recipe steps, instructions, locations and links come from the curated data.

## Data and provenance

- Ingredient energy values are rounded reference estimates. Adjust the ingredient entries for actual brands and preparation. References include [USDA FoodData Central](https://fdc.nal.usda.gov/) and [USDA safe cooking temperatures](https://ask.fsis.usda.gov/article/What-is-a-safe-internal-temperature-for-cooking-meat-and-poultry).
- Activity energy uses MET × 3.5 × demo weight in kg ÷ 200 × minutes, rounded to 5 kcal. See the [2024 Adult Compendium of Physical Activities](https://pacompendium.com/adult-compendium/) and [CDC intensity guidance](https://www.cdc.gov/physical-activity-basics/measuring/index.html). Effort can be tuned by individual comfort and preferences. The app does not assign workouts by gender.
- The weight-goal view is an adult habit roadmap for small changes. It does not compute a deficit, prescribe a diet, or predict when a user will reach a goal. See [CDC guidance on healthy weight](https://www.cdc.gov/healthy-weight-growth/losing-weight/).
- Food images are generated illustrations prepared for this project. See [NOTICE](NOTICE) for asset and SDK provenance.
- This source was written for #BuildHybridAI in November 2026. It uses the existing Devpost entry. The source audit located the draft receipt but did not identify earlier implementation code or a Firebase configuration for this product. No commercial Viera application code was copied.

## Upstream SDK and license

The app source is Apache-2.0. The bundled [official Firebase JS SDK 13.4.0 modules](https://firebase.google.com/support/release-notes/js#version_1340_-_november_16_2026) are Apache-2.0. In the Cloud and App Check modules, the absolute CDN import of the app module was changed to its equivalent relative path so all three modules can load offline from the app origin. The official CDN originals are `firebase-app.js`, `firebase-ai.js` and `firebase-app-check.js` under `https://www.gstatic.com/firebasejs/13.4.0/`.

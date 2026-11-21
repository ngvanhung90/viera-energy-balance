# Viera Energy Balance

Viera helps adults turn a dinner idea into an executable evening. Search Asian and European dishes by name or ingredient, or sort by an estimated plate-energy target. Scale servings, check off ingredients, follow the written recipe or a linked cooking video, and open a store route in Maps. Choose movement by comfortable effort and time. Favorites and weight-goal habit plans stay in the browser or app.

## Run the web app

Use Node.js 22 or newer. The app has no package install step.

```sh
npm test
npm start
```

Open `http://127.0.0.1:4173`. For hosting, serve `public/` on HTTPS. After the first complete load, the service worker caches the application, recipes, images and Firebase SDK modules. Cooking videos and directions use external services and need a connection. The included Ho Chi Minh City directory demonstrates navigation. Check store availability in Maps.

## Android

The Android app lives in `android/` and packages the same UI and recipe content. It uses the native Firebase Android SDK from `NativeCoach.kt` via an origin-scoped WebView message channel. The HTML served in an ordinary phone browser uses the web adapter instead.

The source targets API 35, compiles with Android SDK 36 and Build Tools 35.0.0, and uses JDK 17, Gradle 8.13, Android Gradle Plugin 8.13.2, Kotlin 2.4.21 and D8/R8 9.1.29. The on-device SDK pulls in ML Kit classes with Kotlin 2.4 metadata. Point your local environment to an installed SDK and use the approved Android build producer for your machine. With those dependencies and an authorized build environment, run `gradle :app:assembleDebug` from `android/`.

## Set up a zero-spend Firebase project

1. Use a dedicated Firebase project. In Firebase and Cloud consoles verify **Spark** and **no linked Cloud Billing**. Confirm availability of the Gemini Developer API free tier for that project and verify its current limits. Leave these settings in effect for the judging period.
2. In **AI Services → AI Logic**, initialize the **Gemini Developer API** provider. Register the appropriate Web or Android app. For Android use `com.vieralabs.energybalance`. Use the Firebase app configuration, without a separate Gemini API key.
3. Keep App Check enforcement enabled. For a hosted Web app use an App Check reCAPTCHA Enterprise score-based site key tied to its actual HTTPS host. For Android release builds use Play Integrity and register the release signing fingerprint for the supported distribution channel. On a controlled debug build use Firebase’s App Check debug provider. Register that environment’s debug token privately in Firebase, with App Check still enforced. Keep debug tokens and project configuration outside this repository.
4. For Web, copy `public/firebase-config.example.json` to the ignored `public/firebase-config.json` and fill in the Firebase web config. On localhost only, set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in the browser’s private development console before the first cloud run when using debug attestation. Read and register the emitted token locally. For hosted Web set the public reCAPTCHA site key in the config file. For Android, copy `android/viera-native-config.example.json` to the ignored `android/app/attestation/viera-native-config.json` and use the registered Android app’s config.
5. Set `sparkBillingVerified` to `true` only after confirming Step 1 for that project. Cloud calls are also gated by consent and App Check token acquisition. The app uses `gemini-3.5-flash-lite` and applies a cooldown after quota errors.

## Verify the execution paths

| Path | Reproduce with synthetic preferences | Evidence to capture |
| --- | --- | --- |
| On-device | Use Chrome Desktop with Gemini Nano already installed, or an Android Nano 4 test device with AICore and the applicable preview model already installed. Load the app, disable connectivity in the test environment, choose **On-device only**, build a plan. | SDK `ON_DEVICE`, resulting pair, environment/browser or AICore/model version, no Firebase AI Logic requests during the run. |
| Cloud | On the reviewed Spark project, enable synthetic prompt sharing, choose **Cloud demo only**, build a plan. | SDK `IN_CLOUD`, selected model and returned pair, a successful Firebase AI Logic proxy request and verified App Check count. |
| App Check | Compare a properly attested request against a clean test client without registered attestation while enforcement stays enabled. | Sanitized verified success and rejection, plus enforcement and Spark plan read-back. Keep request headers and tokens private. |
| Fallback | Try an unsupported device, an offline or slow connection, and a quota rejection in a bounded test. | A clear reason and a usable catalog result for each. For quota handling use a controlled test response for client UI coverage and distinguish it from live service evidence. |

The app checks model readiness before SDK initialization. It leaves model download to the permitted test environment and requires an actual recorded model result for the inference badge. The Android implementation requests the Nano 4 Fast preview and checks the reported `nano-v4` model name. The web implementation uses the official Firebase JS 13.4.0 SDK via `getAI`, `getGenerativeModel`, `initializeDeviceModel` and `generateContent`. The Android implementation uses Firebase AI Logic 18.2.0 and Firebase AI Logic On-Device 16.0.0-beta08 and calls `generateContent` natively.

Both platforms use explicit device-only and cloud-only SDK branches so private preferences and weight goals never enter a cloud fallback. The cloud prompt uses a sample preference profile, catalog choices and the selected demo filters. The model picks a recipe and activity from an approved set and returns structured IDs. The app rejects invalid IDs or results with an unexpected execution source. Nutrition, recipe steps, instructions, locations and links come from the curated data.

## Data and provenance

- Ingredient energy values are rounded reference estimates. Adjust the ingredient entries for actual brands and preparation. References include [USDA FoodData Central](https://fdc.nal.usda.gov/) and [USDA safe cooking temperatures](https://ask.fsis.usda.gov/article/What-is-a-safe-internal-temperature-for-cooking-meat-and-poultry).
- Activity energy uses MET × 3.5 × demo weight in kg ÷ 200 × minutes, rounded to 5 kcal. See the [2024 Adult Compendium of Physical Activities](https://pacompendium.com/adult-compendium/) and [CDC intensity guidance](https://www.cdc.gov/physical-activity-basics/measuring/index.html). Effort can be tuned by individual comfort and preferences. The app does not assign workouts by gender.
- The weight-goal view is an adult habit roadmap for small changes. It does not compute a deficit, prescribe a diet, or predict when a user will reach a goal. See [CDC guidance on healthy weight](https://www.cdc.gov/healthy-weight-growth/losing-weight/).
- Food images are generated illustrations prepared for this project. Technique videos are linked or loaded from the original YouTube creators on request and are outside this repository’s license.
- This source was written for #BuildHybridAI in November 2026. It uses the existing Devpost entry. The source audit located the draft receipt but did not identify earlier implementation code or a Firebase configuration for this product. No commercial Viera application code was copied.

## Upstream SDK and license

The app source is Apache-2.0. The bundled [official Firebase JS SDK 13.4.0 modules](https://firebase.google.com/support/release-notes/js#version_1340_-_november_16_2026) are Apache-2.0. In the Cloud and App Check modules, the absolute CDN import of the app module was changed to its equivalent relative path so all three modules can load offline from the app origin. The official CDN originals are `firebase-app.js`, `firebase-ai.js` and `firebase-app-check.js` under `https://www.gstatic.com/firebasejs/13.4.0/`.

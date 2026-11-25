# Viera Energy Balance

Viera helps adults turn a dinner idea into an evening plan. Search Asian and European dishes by name or ingredient, or sort by an estimated plate-energy target. Scale servings, check off ingredients, follow the written recipe or a linked cooking video, and open a store route in Maps. Add the selected meal and a movement routine, then save the pairing on the device. The coach also offers pairings to review and save. Favorites and weight-goal habit plans stay on the device. In the working source, **Use this plan again** opens a completed plan as a draft and leaves the saved plan in place until you choose to save.

### Buy a prepared meal nearby

Open a meal and choose **Buy it nearby**. Tap **Use current location** to use one foreground Android location fix, or **Enter another location** to pick a landmark, use coordinates, or look up a place name. Android’s system dialog lets the user choose precise or approximate location when permission is needed. Viera uses the reported accuracy and filters by straight-line distance within 5 km. If its directory has no menu match, Viera looks for possible venues in open map data and suggests catalog dishes near the calorie target. The open sheet retains its results and calorie alternatives offline.

Photon receives the area name when submitted. After the user chooses a point, an open-map venue lookup can send a rounded center, a bounding box and a food category. Requests are limited, with no autocomplete or automatic retry. Viera keeps precise device coordinates in the open meal sheet for local distance calculations. It does not save location or send it to Gemini. Directions open only when tapped and provide the destination. The fallback Maps search shares the dish and selected area or rounded coordinates with Google when opened. Maps search can extend past 5 km. [Photon](https://github.com/komoot/photon#demo-server) · [OpenStreetMap attribution](https://www.openstreetmap.org/copyright) · [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)

The bundled menu references cover examples in Ho Chi Minh City and Paris. **Listed on menu** means the displayed dish variant appears on the linked menu as checked on 22 November 2026. Confirm current availability, takeaway and dietary ingredients with the restaurant. Venues found by name or category in open map data appear as **Possible match**. Nutrition is shown separately. Viera's kcal figures come from its own ingredient weights and serving sizes, and the listed restaurants have no verified published kcal in this build.

Under **Cook it myself → Where to shop**, use a device fix or choose another area. Photon/OpenStreetMap returns possible supermarkets and grocery shops, then Viera filters by a 5 km straight-line radius. Listings don’t establish ingredient stock. Open Maps only when you choose a shop's directions or the external search.

The catalog adds six original recipes using measured ingredients and energy values from the public-domain [USDA FoodData Central SR Legacy CSV, April 2018](https://fdc.nal.usda.gov/download-datasets/). Ingredient order matches the FDC record IDs shown in each new recipe. Preparation times assume ingredients labeled *cooked* or *prepared* are ready. The 2024 Adult Compendium reference activities for yoga, strength and cardio are 02150, 02056 and 02005 respectively. A supplied body weight changes the MET estimate only on the device. Completed plans are recorded only on request, kept locally, and inform later local rankings. Cloud uses the synthetic demo profile.

| Place | Menu or category evidence | Address and map pin |
| --- | --- | --- |
| Propaganda Vietnamese Bistro | [Restaurant menu](https://propagandabistros.com/wp-content/uploads/2023/12/food-menu-pp-190423-ol.pdf) | [21 Hàn Thuyên](https://aroundus.com/p/171587713-propaganda-vietnamese-bistro) |
| Bếp Cuốn Sài Gòn | [Restaurant menu](https://bepcuon.net/thuc-don/) | [Official address](https://bepcuon.net/) · [Pin metadata](https://pinguide.city/places/bep-cuon-sai-gon/) |
| A Taste of Saigon – Old Market | [Branch menu](https://atasteofsaigon.vn/wp-content/uploads/2025/07/Old-Market-FOOD-MENU.pdf) | [Branch contact and its Maps pin](https://atasteofsaigon.vn/contact-us/) |
| Secret Garden – Lê Công Kiều | [Restaurant category description](https://secretgardensaigon.com/) | [Branch address and its Maps pin](https://secretgardensaigon.com/) |
| Don Giovanni | [Restaurant menu](https://www.dongiovanniparis.com/carte) | [OpenStreetMap pin](https://www.openstreetmap.org/node/8016720377) |
| Amalfi | [Restaurant menu and address](https://www.restaurant-amalfi.fr/carte-pates-fraiches-paris-12/) | [OpenStreetMap pin](https://www.openstreetmap.org/node/11364651926) |
| Amalfitana | [Restaurant menu and address](https://amalfitana-paris.com/fr/menu/notre-carte) | [OpenStreetMap address point](https://www.openstreetmap.org/node/2026702530) |

The directory stores factual names, addresses, positions and source links. It does not redistribute menus, photos or reviews. The Bến Thành location anchor comes from [Wikidata](https://www.wikidata.org/wiki/Q3232879).

## Android

The Android app lives in `android/` and packages the same UI and recipe content. It uses the native Firebase Android SDK from `NativeCoach.kt` via an origin-scoped WebView message channel. The HTML served in an ordinary phone browser uses the web adapter instead.

The source targets API 35, compiles with Android SDK 36 and Build Tools 35.0.0, and uses JDK 17, Gradle 8.13, Android Gradle Plugin 8.13.2, Kotlin 2.4.21 and D8/R8 9.1.29. The on-device SDK pulls in ML Kit classes with Kotlin 2.4 metadata. Point your local environment to an installed SDK and use the approved Android build producer for your machine. With those dependencies and an authorized build environment, run `gradle :app:assembleDebug` from `android/`.

### #BuildHybridAI Android reviewer build

The signed contest candidate is **Viera Rose 0.2.0** for `com.vieralabs.energybalance`. Its APK SHA-256 is `b9691e4020160599ad472d48c6db6bb3bca9295e8b5a46f60cf44418a3461afe`. The source archive updates README.md and NOTICE after signing. The other 61 source files match the Rose build inputs. A build you compile or sign yourself has its own hash.

#### Reviewer walkthrough

1. Check the signed APK against the GitHub Release's `SHA256SUMS.txt` and install it on Android 8.0 (API 26) or newer with Android System WebView.
2. In **Meals**, search for **rice paper** and open **Shrimp & herb rice paper rolls**. Change **Servings** from 1 to 1½ to see the recipe estimate go from about 350 to 525 kcal. **Cook it myself** opens the recipe. **Buy it nearby** opens the prepared-food search. Venue availability and portions can differ from recipe estimates.
3. Add the meal and **Gentle standing yoga**, save the plan, then reopen **Plan**. To request a pairing without Internet, open **Plan → Adjust your plan → Coaching and privacy** and choose **Offline Rules** with Cloud consent off.
4. For Cooking, use **Cook it myself → Call Viera**. For Fitness, use **Move → Call Viera**. Both Live setup screens are visible on this signed Rose APK. The camera and microphone start off. **Start Live call** requires explicit consent. You can inspect the Activity and Effort pickers locally.
5. Use only staged demo inputs for any separately authorized online test. Live needs a network and Play Integrity App Check. The Cloud Planner uses synthetic preferences after explicit consent. Look for the SDK's `IN_CLOUD` marker. For **Gemini Nano only**, keep Cloud sharing off and use an Android device compatible with AICore and Nano 4 Fast preview. Download is optional on supported devices with validated unmetered connectivity and at least 4 GiB free. A Nano result needs the SDK's `ON_DEVICE` marker and a valid catalog pairing.

#### Verification on this APK

| Area | Evidence |
| --- | --- |
| Android 15 offline UI | Passed on an isolated Android emulator after checking the installed APK hash. Evidence includes recipe portions, the nearby-search entry, saved-plan reopening, Native Cooking and Fitness setup, Fitness selection and large text. |
| Gemini Live | Cooking and Fitness setup were verified before a call. No online Live session, model response or SDK resumption was tested on this Rose APK. The film labels offline setup and scripted dialogue. |
| Cloud Planner | No Cloud Planner request was made on this Rose APK. The earlier signed APK `08e4834e` returned `IN_CLOUD` with App Check on Android 16. |
| Nano 4 | Integrated through Firebase AI Logic and AICore. No `ON_DEVICE` result has been verified on a compatible device. |

The local review ran with no Firebase requests or Live sessions. English, Vietnamese, Spanish and French are supported according to Android's language preferences.

## Run the web app

Use Node.js 22 or newer. The app has no package install step.

```sh
npm test
npm start
```

Open `http://127.0.0.1:4173`. For hosting, serve `public/` on HTTPS. After the first complete load, the service worker caches the application, recipes, images and Firebase SDK modules.

## Set up a zero-spend Firebase project

1. Use a dedicated Firebase project. In Firebase and Cloud consoles verify **Spark** and **no linked Cloud Billing**. Confirm availability of the Gemini Developer API free tier for that project and verify its current limits. Leave these settings in effect for the judging period.
2. In **AI Services → AI Logic**, initialize the **Gemini Developer API** provider after the project owner reviews and accepts the Gemini terms. Verify that the wizard enabled both the Gemini Developer API (`generativelanguage.googleapis.com`) and Firebase AI Logic API (`firebasevertexai.googleapis.com`). Register the appropriate Web or Android app. For Android use `com.vieralabs.energybalance`. Use the Firebase app configuration without a separate Gemini API key. [Required APIs](https://firebase.google.com/docs/ai-logic/faq-and-troubleshooting)
3. Keep App Check enforcement enabled. For a hosted Web app use an App Check reCAPTCHA Enterprise score-based site key tied to its actual HTTPS host. For Android release builds use Play Integrity and register the release signing fingerprint for the supported distribution channel. On a controlled debug build use Firebase’s App Check debug provider. Register that environment’s debug token privately in Firebase, with App Check still enforced. Keep debug tokens and project configuration outside this repository.
4. For Web, copy `public/firebase-config.example.json` to the ignored `public/firebase-config.json` and fill in the Firebase web config. On localhost only, set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in the browser’s private development console before the first cloud run when using debug attestation. Read and register the emitted token locally. For hosted Web set the public reCAPTCHA site key in the config file. For Android, copy `android/viera-native-config.example.json` to the ignored `android/app/attestation/viera-native-config.json` and use the registered Android app’s config.
5. Set `sparkBillingVerified` to `true` only after confirming Step 1 for that project. Cloud calls are also gated by consent and App Check token acquisition. The app uses `gemini-3.5-flash-lite` and applies a cooldown after quota errors.
6. To expose Cooking and Fitness Live in a signed reviewer build for the Viera project, verify Free Tier availability for `gemini-3.1-flash-live-preview` and explicitly set `liveFreeTierVerified` and `liveReleaseEnabled` to `true` in the private Android config. Omit `liveQaEnabled` from that build. Calls still require consent, network access and Play Integrity App Check. Use only staged demo audio and camera images without private or identifying material.

## Verify the execution paths

| Path | Reproduce with synthetic preferences | Evidence to capture |
| --- | --- | --- |
| On-device | On an Android Nano 4 test device with AICore and the applicable Fast preview model ready, choose **Gemini Nano only** and build a plan. If a local device can be verified offline, disable connectivity in the authorized QA setup. Preserve the control connection on streamed devices. | SDK `ON_DEVICE`, resulting pair, AICore/model version, and no cloud inference during the run. |
| Cloud | On the reviewed Spark project, enable synthetic prompt sharing, choose **Gemini Cloud demo only**, and build a plan. | SDK `IN_CLOUD`, selected model and returned pair, a successful Firebase AI Logic proxy request and verified App Check count. |
| App Check | Keep enforcement enabled. Compare the attested APK request with one synthetic request from the separate Android instrumentation APK using an isolated Firebase instance without an App Check provider. The app's local token-acquisition failure does not reach the AI Logic proxy. | Sanitized verified success and server rejection, plus enforcement and Spark plan read-back. Keep request headers and tokens private. |
| Fallback | Try an unsupported device, an offline or slow connection, and a quota rejection in a bounded test. | A clear reason and a usable catalog result for each. For quota handling use a controlled test response for client UI coverage and distinguish it from live service evidence. |

The app checks model readiness before SDK initialization. It leaves model download to the permitted test environment and requires an actual recorded model result for the inference badge. The Android implementation requests the Nano 4 Fast preview and checks the reported `nano-v4` model name. The web implementation uses the official Firebase JS 13.4.0 SDK via `getAI`, `getGenerativeModel`, `initializeDeviceModel` and `generateContent`. The Android implementation uses Firebase AI Logic 18.2.0 and Firebase AI Logic On-Device 16.0.0-beta08 and calls `generateContent` natively.

For reviewer builds, keep Firebase AI Logic App Check enforcement enabled and use the existing Play Integrity configuration. Setup for your own independently signed build requires an app registration and an attestation configuration you administer. Keep private Firebase configuration, debug tokens and signing material outside source control. [Play Integrity provider](https://firebase.google.com/docs/app-check/android/play-integrity-provider)

Both platforms use explicit device-only and cloud-only SDK branches so private preferences and weight goals never enter a cloud fallback. The cloud prompt uses a sample preference profile, catalog choices and the selected demo filters. The model picks a recipe and activity from an approved set and returns structured IDs. The app rejects invalid IDs or results with an unexpected execution source. Nutrition, recipe steps, instructions, locations and links come from the curated data.

## Data and provenance

- Ingredient energy values are rounded reference estimates. Adjust the ingredient entries for actual brands and preparation. References include [USDA FoodData Central](https://fdc.nal.usda.gov/) and [USDA safe cooking temperatures](https://ask.fsis.usda.gov/article/What-is-a-safe-internal-temperature-for-cooking-meat-and-poultry).
- Activity energy uses MET × 3.5 × demo weight in kg ÷ 200 × minutes, rounded to 5 kcal. See the [2024 Adult Compendium of Physical Activities](https://pacompendium.com/adult-compendium/) and [CDC intensity guidance](https://www.cdc.gov/physical-activity-basics/measuring/index.html). Effort can be tuned by individual comfort and preferences. The app does not assign workouts by gender.
- The weight-goal view is an adult habit roadmap for small changes. It does not compute a deficit, prescribe a diet, or predict when a user will reach a goal. See [CDC guidance on healthy weight](https://www.cdc.gov/healthy-weight-growth/losing-weight/).
- Food images are generated illustrations prepared for this project. See [NOTICE](NOTICE) for asset and SDK provenance.
- The available Viera Energy Balance Git history starts at commit `4f7627e` dated 21 November 2026. It uses the existing Devpost entry. The source audit located the draft receipt but did not identify earlier implementation code or a Firebase configuration for this product.

## Upstream SDK and license

The app source is Apache-2.0. The bundled [official Firebase JS SDK 13.4.0 modules](https://firebase.google.com/support/release-notes/js#version_1340_-_november_16_2026) are Apache-2.0. In the Cloud and App Check modules, the absolute CDN import of the app module was changed to its equivalent relative path so all three modules can load offline from the app origin. The official CDN originals are `firebase-app.js`, `firebase-ai.js` and `firebase-app-check.js` under `https://www.gstatic.com/firebasejs/13.4.0/`.

Viera's original contest source and accompanying assets are licensed under [Apache-2.0](LICENSE) to the extent the project can grant those rights. Android SDKs, libraries and external data retain their upstream terms. See [NOTICE](NOTICE) for dependencies and credits. Distribute the signed APK together with `ANDROID_THIRD_PARTY_NOTICES.zip`, which carries upstream notice and license files from the resolved Android libraries. The Apache license does not grant general rights in the Viera name, logo or other marks beyond its Section 6 permissions.

Use the sample configuration with your own Firebase project for an independent build. The signed reviewer APK embeds Firebase client configuration for the contest project. The Firebase client API key identifies the project and app to Firebase services. Keep its API allowlist limited to the required Firebase APIs and exclude the Gemini Developer API from that client key. Keep App Check enforced with Play Integrity. Keep server credentials, signing material and App Check debug tokens private. [Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys)

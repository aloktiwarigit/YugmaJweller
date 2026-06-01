# App-Store Privacy Labels — Virtual Try-On

The try-on feature runs entirely on-device (MediaPipe Tasks Vision, WASM). No
camera frame, image, video, or biometric template is collected, stored, or
transmitted. Only a consent **event** (no camera data) is recorded.

## Google Play — Data safety form

- **Camera (photos/videos):** Accessed, **not collected**, **not shared**.
  Purpose: App functionality (virtual try-on preview). Processed on-device only.
- **Biometric / face data:** **Not collected.** No face embedding, template,
  age/gender/skin-tone inference.
- **Data shared with third parties:** None for try-on.
- **Data deletion:** No try-on data is stored, so there is nothing to delete;
  camera permission is revocable in OS settings.

## Apple App Store — App Privacy ("Nutrition label")

- **Data Not Collected** for the try-on feature (camera is used in real time and
  discarded each frame; nothing leaves the device).
- `NSCameraUsageDescription` (iOS): "आभूषण को वर्चुअली पहनकर देखने के लिए कैमरा
  का उपयोग होता है। कोई फ़ोटो या वीडियो सहेजी या भेजी नहीं जाती।"

## Enforcement

- Semgrep `goldsmith.no-try-on-direct-network` (ops/semgrep/no-try-on-egress.yaml)
  blocks raw network calls inside `apps/customer-web/components/try-on/**`.
- The customer-mobile WebView is origin-locked to the configured `webBaseUrl`
  (`originWhitelist` + `onShouldStartLoadWithRequest`), so the auto-granted
  camera cannot reach any origin other than the trusted try-on page.
- Runtime QA: DevTools/proxy network capture must show zero outbound requests
  carrying camera frames during a try-on session.

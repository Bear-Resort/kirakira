# Vendored third-party files

Served from this site (not a CDN) so everything works in mainland China.
Each file was checked against jsDelivr's published SHA-256 before being added.

| Path | Source | License |
|---|---|---|
| `three-0.149.0/three.min.js` | npm `three@0.149.0` `build/three.min.js` | MIT (see `three-0.149.0/LICENSE`) |
| `mediapipe-tasks-vision-0.10.14/vision_bundle.mjs`, `wasm/vision_wasm_internal.{js,wasm}` | npm `@mediapipe/tasks-vision@0.10.14` | Apache-2.0 — https://www.apache.org/licenses/LICENSE-2.0 |
| `models/magic_touch.tflite` | `storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/` | Apache-2.0 (MediaPipe models) |

Only the SIMD build of the MediaPipe wasm is included (all current iOS/Android browsers support it).

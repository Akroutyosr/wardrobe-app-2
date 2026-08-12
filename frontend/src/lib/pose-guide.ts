import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

let landmarker: PoseLandmarker | null = null;

export async function initPoseDetector() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  );
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
    },
    runningMode: "VIDEO",
  });
}

// MediaPipe pose landmark indices used by the full-body check below.
const KEYPOINTS = { nose: 0, leftAnkle: 27, rightAnkle: 28 };

/**
 * Returns whether ankles + shoulders + head are all visible in frame — a rough
 * "full body is in shot" check, not full anatomical validation. The fitting
 * room wants a full-length shot so IDM-VTON can composite garments correctly.
 */
export function checkFullBodyInFrame(video: HTMLVideoElement): {
  ok: boolean;
  message: string;
} {
  if (!landmarker) return { ok: false, message: "Detector not ready" };
  const result = landmarker.detectForVideo(video, performance.now());
  const landmarks = result.landmarks[0];
  if (!landmarks) return { ok: false, message: "No person detected" };

  const visible = (i: number) => (landmarks[i]?.visibility ?? 0) > 0.5;

  if (!visible(KEYPOINTS.nose)) {
    return { ok: false, message: "Move back so your head is visible" };
  }
  if (!visible(KEYPOINTS.leftAnkle) || !visible(KEYPOINTS.rightAnkle)) {
    return { ok: false, message: "Step back so your feet are visible" };
  }
  return { ok: true, message: "Looking good — hold still" };
}

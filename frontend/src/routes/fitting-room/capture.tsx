import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ImagePlus, Loader2, ShieldCheck } from "lucide-react";
import { uploadFittingPhoto } from "@/lib/api";
import { deviceId } from "@/lib/utils";
import { checkFullBodyInFrame, initPoseDetector } from "@/lib/pose-guide";

export const Route = createFileRoute("/fitting-room/capture")({
  head: () => ({
    meta: [
      { title: "Add your photo · Fitting Room · Twinish" },
      {
        name: "description",
        content:
          "Upload a full-length photo of yourself (or capture one with pose guidance) to try on outfits from your closet.",
      },
    ],
  }),
  component: Capture,
});

function Capture() {
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // camera mode
  const [cameraOn, setCameraOn] = useState(false);
  const [guide, setGuide] = useState("Detector not ready");
  const [guideOk, setGuideOk] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      await initPoseDetector();
    } catch {
      // MediaPipe model fetch failed (offline / blocked CDN) -- still allow
      // the camera to open, just without the live pose guidance.
      console.warn("Pose detector unavailable, using unguided capture");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1080, height: 1920 },
      });
      streamRef.current = stream;
      setCameraOn(true);
      // set the stream on the video element after it mounts in DOM
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play();
          const tick = () => {
            const res = checkFullBodyInFrame(video);
            setGuide(res.message);
            setGuideOk(res.ok);
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      });
    } catch {
      setError("Couldn't open your camera — try uploading a photo instead.");
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const captureShot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "fitting-capture.jpg", { type: "image/jpeg" });
        setPhoto(file);
        setPreviewUrl(URL.createObjectURL(file));
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
    stopCamera();
  };

  const submit = async () => {
    if (!photo) return;
    setSubmitting(true);
    setError(null);
    try {
      const { image_path } = await uploadFittingPhoto(photo, consent, deviceId());
      await navigate({ to: "/fitting-room", search: { photo: image_path } });
    } catch (e) {
      setError(`Upload failed: ${String(e)}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-float-in">
      <Link
        to="/fitting-room"
        search={{}}
        className="tappable mb-4 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-polaroid"
      >
        <ArrowLeft size={15} /> Fitting room
      </Link>

      <h1 className="display text-4xl">Your photo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A full-length shot works best — head and feet in frame, standing straight.
      </p>

      {!photo ? (
        <>
          {cameraOn ? (
            <div className="relative mt-4 overflow-hidden rounded-4xl bg-ink shadow-lift">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[3/4] w-full object-cover"
              />
              {/* translucent body silhouette overlay */}
              <svg
                viewBox="0 0 100 160"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
                aria-hidden="true"
              >
                <g fill="none" stroke="#fff" strokeWidth="2">
                  <circle cx="50" cy="26" r="9" />
                  <path d="M50 35c-13 2-18 10-19 22l-3 45 9 8 10-16 6-2 6 2 10 16 9-8-3-45c-1-12-6-20-19-22Z" />
                  <path d="M50 62l0 40M50 62l-16 26M50 102l16-26" />
                </g>
              </svg>
              <div className="absolute inset-x-0 bottom-0 bg-black/40 px-4 py-3 text-center text-sm font-bold text-white">
                {guide}
              </div>
              <button
                onClick={captureShot}
                disabled={!guideOk}
                className="tappable absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-rose px-6 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-40"
              >
                <Camera size={18} className="mr-1 inline" /> Snap it
              </button>
              <button
                onClick={stopCamera}
                className="tappable absolute right-3 top-3 rounded-full bg-black/40 px-3 py-1.5 text-xs font-bold text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <button
                onClick={() => document.getElementById("fitting-photo-input")?.click()}
                className="tappable w-full rounded-4xl bg-card p-7 text-center shadow-lift"
              >
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blossom text-ink">
                  <ImagePlus size={30} />
                </span>
                <span className="display mt-3 block text-2xl">Upload a photo</span>
                <span className="mt-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  you probably have a good one already
                </span>
              </button>
              <input
                id="fitting-photo-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <button
                onClick={startCamera}
                className="tappable w-full rounded-4xl bg-rose p-7 text-center text-primary-foreground shadow-lift"
              >
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-card text-rose">
                  <Camera size={30} />
                </span>
                <span className="display mt-3 block text-2xl">Use camera instead</span>
                <span className="mt-1 block text-xs font-bold uppercase tracking-widest opacity-85">
                  live pose guidance so the whole body fits
                </span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4">
          <div className="overflow-hidden rounded-4xl bg-card p-3 shadow-polaroid">
            {previewUrl && (
              <img src={previewUrl} alt="Your preview" className="w-full rounded-3xl" />
            )}
          </div>

          <label className="tappable mt-4 flex items-start gap-3 rounded-2xl bg-card px-4 py-3 shadow-polaroid">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-rose"
            />
            <span className="text-sm font-semibold">
              <span className="flex items-center gap-1">
                <ShieldCheck size={16} className="text-olivine" /> Save this photo on this device
              </span>
              <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                So you don&apos;t need to re-upload it next time. Deleteable any time.
              </span>
            </span>
          </label>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                setPhoto(null);
                setPreviewUrl(null);
              }}
              className="tappable rounded-2xl bg-card px-4 py-3.5 text-sm font-extrabold shadow-polaroid"
            >
              Retake
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="tappable flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose py-3.5 text-sm font-extrabold text-primary-foreground"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
              {submitting ? "Uploading…" : "Continue to outfits"}
            </button>
          </div>
          {error ? <p className="mt-3 text-center text-sm font-bold text-rose">{error}</p> : null}
        </div>
      )}
    </div>
  );
}

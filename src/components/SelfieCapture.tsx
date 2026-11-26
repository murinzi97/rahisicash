import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/index.tsx";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Takes the selfie with the live camera (front camera on phones) so it is a
 * fresh photo, not one picked from the gallery. If the camera cannot be
 * opened, a phone-camera button is offered as a fallback.
 * The camera needs a secure page: https:// or localhost.
 */
export function SelfieCapture({ value, onChange }: { value: Blob | null; onChange: (b: Blob | null) => void }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);
  const [denied, setDenied] = useState(false);
  const [typeError, setTypeError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setLive(false);
  }
  useEffect(() => stopCamera, []); // turn the camera off when leaving the page

  useEffect(() => {
    if (!value) { setPreviewUrl(null); return; }
    const u = URL.createObjectURL(value);
    setPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  useEffect(() => {
    if (live && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [live]);

  async function openCamera() {
    setDenied(false);
    setTypeError(false);
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      setLive(true);
    } catch {
      setDenied(true);
    }
  }

  function takePhoto() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height); // true (not mirrored) image
    canvas.toBlob((b) => { if (b) { onChange(b); stopCamera(); } }, "image/jpeg", 0.85);
  }

  function retake() {
    onChange(null);
    void openCamera();
  }

  function fromPhoneCamera(f: File | undefined) {
    if (!f) return;
    if ((f.type !== "image/jpeg" && f.type !== "image/png") || f.size > MAX_BYTES) {
      setTypeError(true);
      return;
    }
    setTypeError(false);
    onChange(f);
  }

  return (
    <div className="selfie">
      {value && previewUrl ? (
        <>
          <img className="selfie-frame" src={previewUrl} alt={t("selfie.alt")} />
          <button type="button" className="btn btn-outline selfie-btn" onClick={retake}>{t("selfie.retake")}</button>
        </>
      ) : live ? (
        <>
          <video ref={videoRef} className="selfie-frame selfie-video" playsInline muted />
          <button type="button" className="btn selfie-btn" onClick={takePhoto}>{t("selfie.take")}</button>
        </>
      ) : (
        <>
          <div className="selfie-frame selfie-empty" aria-hidden="true" />
          <button type="button" className="btn selfie-btn" onClick={() => void openCamera()}>{t("selfie.open")}</button>
        </>
      )}

      {denied && (
        <>
          <p className="error" role="alert">{t("selfie.denied")}</p>
          <input ref={fallbackRef} type="file" accept="image/*" capture="user" hidden
                 onChange={(e) => fromPhoneCamera(e.target.files?.[0])} />
          <button type="button" className="btn btn-outline selfie-btn" onClick={() => fallbackRef.current?.click()}>
            {t("selfie.fallback")}
          </button>
        </>
      )}
      {typeError && <p className="error" role="alert">{t("register.error.selfieType")}</p>}
    </div>
  );
}

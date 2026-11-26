import { LegalLinks } from "../components/InfoPage.tsx";
import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { routeFor } from "../lib/routing.ts";
import { normalizeAgentPhone } from "../lib/phone.ts";
import { TopTools, Splash } from "../components/Controls.tsx";
import { SelfieCapture } from "../components/SelfieCapture.tsx";
import type { Key } from "../i18n/en.ts";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
type IdType = "national_id" | "passport";

export default function Register() {
  const { t, lang } = useI18n();
  const { session, profile, loading } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [idType, setIdType] = useState<IdType>("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [error, setError] = useState<Key | null>(null);
  const [working, setWorking] = useState(false);
  const [needsUpload, setNeedsUpload] = useState(false); // account exists, files not all saved yet
  const userId = useRef<string | null>(null);
  const idDone = useRef(false);
  const selfieDone = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const locked = Boolean(userId.current); // after the account exists, the details are fixed

  // When the account and both photos are saved, move on by role and status.
  // While signing up or uploading we stay here (the login event would
  // otherwise send us away before the uploads finish).
  if (session && !working && !needsUpload) {
    if (loading) return <Splash />;
    return <Navigate to={routeFor(true, profile)} replace />;
  }

  function fail(k: Key): null { setError(k); return null; }

  function validateStep1(): string | null {
    const p = normalizeAgentPhone(phone);
    if (fullName.trim().length < 2) return fail("register.error.name");
    if (!p) return fail("register.error.phone");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return fail("register.error.email");
    if (password.length < 8) return fail("register.error.password");
    if (idNumber.trim().length < 5) return fail("register.error.idNumber");
    if (!idFile) return fail("register.error.file");
    if (!(idFile.type in TYPES)) return fail("register.error.fileType");
    if (idFile.size > MAX_BYTES) return fail("register.error.fileSize");
    return p;
  }

  function next(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (validateStep1()) setStep(2);
  }

  /** Saves one file and its row. A repeat of an earlier success counts as done. */
  async function saveFile(uid: string, blob: Blob, kind: "id_document" | "selfie"): Promise<boolean> {
    const ext = TYPES[blob.type] ?? "jpg";
    const path = `${uid}/${Date.now()}-${kind}.${ext}`;
    const up = await supabase.storage.from("kyc").upload(path, blob, { contentType: blob.type });
    if (up.error) return false;
    const row = await supabase.from("kyc_documents").insert({ agent_id: uid, storage_path: path, kind });
    return !row.error || row.error.code === "23505";
  }

  async function submit() {
    setError(null);
    const p = validateStep1();
    if (!p || !idFile) { setStep(1); return; }
    if (!selfie) { setError("register.error.selfie"); return; }

    setWorking(true);
    try {
      let uid = userId.current;
      if (!uid) {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim(), phone: p, id_number: idNumber.trim(), id_type: idType, language: lang },
          },
        });
        if (err || !data.user) {
          setError(err?.message.toLowerCase().includes("already") ? "register.error.exists" : "register.error.generic");
          return;
        }
        // Supabase quietly returns a user with no identities for an existing email.
        if (data.user.identities && data.user.identities.length === 0) {
          setError("register.error.exists");
          return;
        }
        if (!data.session) {
          setError("register.error.needsSession"); // email confirmation is ON
          return;
        }
        uid = data.user.id;
        userId.current = uid;
      }
      setNeedsUpload(true);
      if (!idDone.current) idDone.current = await saveFile(uid, idFile, "id_document");
      if (idDone.current && !selfieDone.current) selfieDone.current = await saveFile(uid, selfie, "selfie");
      if (idDone.current && selfieDone.current) {
        setNeedsUpload(false); // the redirect above takes over
      } else {
        setError("register.error.upload");
      }
    } finally {
      setWorking(false);
    }
  }

  const idLabel = (v: IdType) => t(v === "national_id" ? "register.idType.national_id" : "register.idType.passport");

  return (
    <main className="screen center-col form-col">
      <TopTools />
      <h1 className="page-title align-left">{t("register.title")}</h1>
      <p className="subtle align-left">
        {step === 1 ? t("register.step1") : t("register.step2")}
      </p>

      {step === 1 && (
        <form className="card card-form" onSubmit={next} noValidate>
          <label className="label" htmlFor="fn">{t("register.fullName")}</label>
          <input id="fn" className="input" autoComplete="name" placeholder={t("register.fullNamePlaceholder")}
                 value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={locked} />
          <label className="label" htmlFor="ph">{t("register.phone")}</label>
          <input id="ph" className="input" type="tel" inputMode="tel" autoComplete="tel"
                 placeholder={t("register.phonePlaceholder")} value={phone}
                 onChange={(e) => setPhone(e.target.value)} disabled={locked} />
          <label className="label" htmlFor="em">{t("register.email")}</label>
          <input id="em" className="input" type="email" inputMode="email" autoComplete="email"
                 placeholder={t("login.emailPlaceholder")} value={email}
                 onChange={(e) => setEmail(e.target.value)} disabled={locked} />
          <label className="label" htmlFor="pw">{t("register.password")}</label>
          <input id="pw" className="input" type="password" autoComplete="new-password"
                 placeholder={t("register.passwordPlaceholder")} value={password}
                 onChange={(e) => setPassword(e.target.value)} disabled={locked} />

          <span className="label">{t("register.idType")}</span>
          <div className="segmented" role="group" aria-label={t("register.idType")}>
            {(["national_id", "passport"] as IdType[]).map((v) => (
              <button key={v} type="button" className={"segmented-opt" + (idType === v ? " is-on" : "")}
                      aria-pressed={idType === v} disabled={locked} onClick={() => setIdType(v)}>
                {idLabel(v)}
              </button>
            ))}
          </div>
          <label className="label" htmlFor="idn">{t("register.idNumber")}</label>
          <input id="idn" className="input" placeholder={t("register.idPlaceholder")} value={idNumber}
                 onChange={(e) => setIdNumber(e.target.value)} disabled={locked} />

          <span className="label">{t("register.kyc")}</span>
          <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,application/pdf"
                 onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="file-drop" disabled={locked} onClick={() => fileInput.current?.click()}>
            {idFile ? t("register.kycChosen", { name: idFile.name }) : t("register.kycHint")}
          </button>

          {error && <p className="error" role="alert">{t(error)}</p>}
          <button className="btn" type="submit">{t("register.continue")}</button>
          <p className="center-text muted">
            {t("register.haveAccount")}{" "}
            <Link className="link-bold" to="/login">{t("register.login")}</Link>
          </p>
        </form>
      )}

      {step === 2 && (
        <section className="card card-form">
          <h2 className="section-title">{t("selfie.title")}</h2>
          <p className="subtle">{t("selfie.hint")}</p>
          <SelfieCapture value={selfie} onChange={setSelfie} />
          {error && <p className="error" role="alert">{t(error)}</p>}
          <button className="btn" type="button" disabled={working || !selfie} onClick={() => void submit()}>
            {working ? t("register.submitting") : needsUpload ? t("register.retryUpload") : t("register.submit")}
          </button>
          {!locked && (
            <button className="btn btn-outline back-btn" type="button" disabled={working}
                    onClick={() => { setError(null); setStep(1); }}>
              {t("register.back")}
            </button>
          )}
        </section>
      )}
    <LegalLinks />
    </main>
  );
}

import { useEffect, useState } from "react";
import { avatarUrl } from "../lib/avatar.ts";
import { initials } from "../lib/initials.ts";
import { useI18n } from "../i18n/index.tsx";

/** The agent's verified selfie, or their initials until it loads / if missing. */
export function Avatar({ path, name, size = 44 }: { path: string | null; name: string; size?: number }) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (path) void avatarUrl(path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [path]);

  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return url ? (
    <img className="avatar" style={style} src={url} alt={t("avatar.alt", { name })} />
  ) : (
    <span className="avatar avatar-initials" style={style} aria-hidden="true">{initials(name)}</span>
  );
}

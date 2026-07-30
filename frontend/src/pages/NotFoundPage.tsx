import { Radar } from "lucide-react";
import { useI18n } from "../context/I18nContext";
import { Link } from "../context/RouterContext";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="grid min-h-[70vh] place-items-center px-5 text-center">
      <div>
        <Radar className="mx-auto h-12 w-12 text-violet" />
        <p className="mt-5 text-sm uppercase tracking-[.25em] text-muted">
          {t("notFound.eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          {t("notFound.title")}
        </h1>
        <Link to="/" className="button-primary mt-6 inline-flex">
          {t("notFound.back")}
        </Link>
      </div>
    </div>
  );
}

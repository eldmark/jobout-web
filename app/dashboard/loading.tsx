import { t } from "@/lib/messages";

export default function Loading() {
  return (
    <main className="pagina" aria-busy="true">
      <p role="status">{t("dashboard.loading")}</p>
    </main>
  );
}

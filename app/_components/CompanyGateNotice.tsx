import Link from "next/link";
import type { CompanyGate } from "@/lib/company/rules";
import { t, type MessageKey } from "@/lib/messages";

const TEXTOS: Record<Exclude<CompanyGate, "ok">, { titulo: MessageKey; cuerpo: MessageKey }> = {
  unverified: { titulo: "company.gate.unverified.title", cuerpo: "company.gate.unverified.body" },
  noMembership: { titulo: "company.gate.noMembership.title", cuerpo: "company.gate.noMembership.body" },
  expired: { titulo: "company.gate.expired.title", cuerpo: "company.gate.expired.body" },
};

/** FC8: empresa sin verificar, sin membresía o con la membresía vencida: qué pasa y qué hacer. */
export default function CompanyGateNotice({ gate, link = false }: { gate: CompanyGate; link?: boolean }) {
  if (gate === "ok") return null;
  const x = TEXTOS[gate];
  return (
    <section className="aviso aviso--accion" aria-labelledby={`aviso-${gate}`}>
      <h2 id={`aviso-${gate}`}>{t(x.titulo)}</h2>
      <p>{t(x.cuerpo)}</p>
      {link ? (
        <p>
          <Link href="/company">{t("panel.toCompany")}</Link>
        </p>
      ) : null}
    </section>
  );
}

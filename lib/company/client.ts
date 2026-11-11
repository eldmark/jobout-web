/** Llamadas del navegador del lado empresa y de administración (/api/*). Nunca ven tokens. */
import { call, listQuery } from "@/lib/offers/client";
import type { Page } from "@/lib/offers/types";
import type {
  AdminCompany,
  Company,
  CompanyInput,
  CompanyRole,
  Invitation,
  OfferDetail,
  OfferInput,
  OfferRow,
  OfferStatus,
  PanelApplication,
  PanelQuery,
  PanelRow,
  Recruiter,
  RecruiterTarget,
} from "./types";

/** La consulta del panel: solo lo del contrato (PA9). `recent` es el orden por defecto. */
export function panelQuery(q: PanelQuery): string {
  const s = new URLSearchParams();
  if (q.limit !== undefined) s.set("limit", String(q.limit));
  if (q.cursor !== undefined) s.set("cursor", q.cursor);
  if (q.status !== undefined) s.set("status", q.status);
  if (q.favorite !== undefined) s.set("favorite", String(q.favorite));
  if (q.sort && q.sort !== "recent") s.set("sort", q.sort);
  const texto = s.toString();
  return texto ? `?${texto}` : "";
}

const oferta = (id: string) => `/api/company/offers/${id}`;
const aplicacion = (id: string) => `/api/company/applications/${id}`;

export const companyApi = {
  get: () => call<Company>("/api/company"),
  create: (input: CompanyInput) => call<Company>("/api/company", "POST", input),
  update: (input: CompanyInput) => call<null>("/api/company", "PUT", input),
  recruiters: (p: { limit?: number; cursor?: string } = {}) => call<Page<Recruiter>>(`/api/company/recruiters${listQuery(p)}`),
  removeRecruiter: (id: string) => call<null>(`/api/company/recruiters/${id}`, "DELETE"),
  invitations: (p: { limit?: number; cursor?: string } = {}) => call<Page<Invitation>>(`/api/company/invitations${listQuery(p)}`),
  invite: (email: string, role: CompanyRole) => call<Invitation>("/api/company/invitations", "POST", { email, role }),
  revokeInvitation: (id: string) => call<null>(`/api/company/invitations/${id}`, "DELETE"),
  acceptInvitation: (token: string) => call<{ company: { id: string; name: string }; role: CompanyRole }>("/api/invitations/accept", "POST", { token }),
  offers: (p: { limit?: number; cursor?: string; status?: OfferStatus } = {}) => call<Page<OfferRow>>(`/api/company/offers${listQuery(p)}`),
  offer: (id: string) => call<OfferDetail>(oferta(id)),
  createOffer: (input: OfferInput) => call<OfferDetail>("/api/company/offers", "POST", input),
  updateOffer: (id: string, input: OfferInput) => call<null>(oferta(id), "PUT", input),
  deleteOffer: (id: string) => call<null>(oferta(id), "DELETE"),
  publishOffer: (id: string) => call<{ id: string; status: OfferStatus; publication_date: string }>(`${oferta(id)}/publish`, "POST"),
  pauseOffer: (id: string) => call<null>(`${oferta(id)}/pause`, "POST"),
  closeOffer: (id: string) => call<null>(`${oferta(id)}/close`, "POST"),
  panel: (offerId: string, q: PanelQuery) => call<Page<PanelRow>>(`${oferta(offerId)}/applications${panelQuery(q)}`),
  panelApplication: (id: string) => call<PanelApplication>(aplicacion(id)),
  /** La nota es opcional: vacía o solo espacios no viaja. */
  move: (id: string, to: RecruiterTarget, note?: string) => {
    const n = note?.trim();
    return call<PanelApplication>(`${aplicacion(id)}/status`, "POST", n ? { to, note: n } : { to });
  },
  setFavorite: (id: string, on: boolean) => call<null>(`${aplicacion(id)}/favorite`, on ? "PUT" : "DELETE"),
};

export const adminApi = {
  companies: (p: { verified?: boolean; limit?: number; cursor?: string } = {}) => {
    const s = new URLSearchParams();
    if (p.verified !== undefined) s.set("verified", String(p.verified));
    if (p.limit !== undefined) s.set("limit", String(p.limit));
    if (p.cursor !== undefined) s.set("cursor", p.cursor);
    const q = s.toString();
    return call<Page<AdminCompany>>(`/api/admin/companies${q ? `?${q}` : ""}`);
  },
  verify: (id: string) => call<null>(`/api/admin/companies/${id}/verify`, "POST"),
  unverify: (id: string) => call<null>(`/api/admin/companies/${id}/unverify`, "POST"),
  /** Solo `business` existe en la 5a (no hay cobro). */
  setMembership: (id: string, start: string, end: string) =>
    call<null>(`/api/admin/companies/${id}/membership`, "PUT", { membership_type: "business", start_date: start, expiration_date: end }),
};

/** F16: el dashboard invita a practicar o a retomar la entrevista en curso. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { SID, RESUMEN, pagina } from "./helpers/interview";
import { t } from "@/lib/messages";
import DashboardView from "@/app/_components/DashboardView";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "jo_session" ? { name: n, value: "acc-111" } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
import Dashboard from "@/app/dashboard/page";

const ME = { first_name: "Ana", last_name: "Paz", plan: { code: "free", name: "Gratis" } };
const sp = { searchParams: Promise.resolve({}) };
const resumen = (status: string, id = SID) => RESUMEN({ id, status });

beforeEach(() => vi.stubEnv("API_URL_INTERNA", "http://core-api:8080"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("DashboardView", () => {
  it("sin sesión activa: «Practica una entrevista» hacia /interviews", () => {
    render(<DashboardView me={ME} />);
    expect(screen.getByRole("link", { name: t("dashboard.practice") })).toHaveAttribute("href", "/interviews");
    expect(screen.queryByRole("link", { name: t("dashboard.resume") })).toBeNull();
  });
  it("con sesión activa: «Retoma tu entrevista» hacia esa sesión, y no «Practica»", () => {
    render(<DashboardView me={ME} activeInterviewId={SID} />);
    expect(screen.getByRole("link", { name: t("dashboard.resume") })).toHaveAttribute("href", `/interviews/${SID}`);
    expect(screen.queryByRole("link", { name: t("dashboard.practice") })).toBeNull();
  });
  it("el botón principal usa coral (la tinta sobre coral la fija el CSS)", () => {
    render(<DashboardView me={ME} />);
    expect(screen.getByRole("link", { name: t("dashboard.practice") })).toHaveClass("boton--coral");
  });
  it("si no cargó la persona, no hay CTA", () => {
    render(<DashboardView me={null} />);
    expect(screen.queryByRole("link", { name: t("dashboard.practice") })).toBeNull();
  });
});

describe("página del dashboard", () => {
  /** El backend filtra por `status`: responde solo las sesiones de ese estado, como `{items, next_cursor}`. */
  function con(lista: unknown) {
    return stubFetch((c) => {
      if (c.url.endsWith("/api/v1/me")) return jsonRes(200, ME);
      if (c.url.includes("/api/v1/interviews")) {
        if (typeof lista === "number") return jsonRes(lista);
        if (!Array.isArray(lista)) return jsonRes(200, lista);
        const estado = new URL(c.url).searchParams.get("status");
        return jsonRes(200, pagina((lista as { status: string }[]).filter((x) => x.status === estado)));
      }
      return jsonRes(404);
    });
  }
  const consultas = (ll: { url: string }[]) => ll.filter((c) => c.url.includes("/interviews")).map((c) => new URL(c.url).searchParams);

  it("una sesión in_progress -> «Retoma tu entrevista»", async () => {
    const { llamadas } = con([resumen("completed", "99999999-9999-4999-8999-999999999999"), resumen("in_progress")]);
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.resume") })).toHaveAttribute("href", `/interviews/${SID}`);
    const c = llamadas.find((x) => x.url.includes("/interviews"))!;
    expect(c.headers.get("authorization")).toBe("Bearer acc-111");
  });
  it("pregunta al backend por status=in_progress y status=paused con limit=1 (no baja toda la lista)", async () => {
    const { llamadas } = con([resumen("in_progress")]);
    render(await Dashboard(sp));
    const q = consultas(llamadas);
    expect(q.map((p) => p.get("status")).sort()).toEqual(["in_progress", "paused"]);
    for (const p of q) expect(p.get("limit")).toBe("1");
  });
  it("una sesión pausada también se retoma", async () => {
    con([resumen("paused")]);
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.resume") })).toBeInTheDocument();
  });
  it("si hay una en curso y otra pausada, gana la en curso", async () => {
    const OTRA = "99999999-9999-4999-8999-999999999999";
    con([resumen("paused", OTRA), resumen("in_progress")]);
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.resume") })).toHaveAttribute("href", `/interviews/${SID}`);
  });
  it("solo completadas o abandonadas -> «Practica una entrevista»", async () => {
    con([resumen("completed"), resumen("abandoned")]);
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.practice") })).toBeInTheDocument();
  });
  it("si la lista falla, no tiene la forma {items} o es el arreglo viejo, no rompe: «Practica una entrevista»", async () => {
    for (const lista of [404, 500, { no: "es lista" }, { items: "x" }, "ARREGLO"]) {
      if (lista === "ARREGLO") {
        // el arreglo suelto del contrato viejo ya no es una respuesta válida
        stubFetch((c) => (c.url.endsWith("/api/v1/me") ? jsonRes(200, ME) : jsonRes(200, [resumen("in_progress")])));
      } else con(lista);
      render(await Dashboard(sp));
      expect(screen.getByRole("link", { name: t("dashboard.practice") })).toBeInTheDocument();
      cleanup();
    }
  });
});

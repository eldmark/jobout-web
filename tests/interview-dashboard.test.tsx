/** F16: el dashboard invita a practicar o a retomar la entrevista en curso. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { SID } from "./helpers/interview";
import { t } from "@/lib/messages";
import DashboardView from "@/app/_components/DashboardView";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "jo_session" ? { name: n, value: "acc-111" } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
import Dashboard from "@/app/dashboard/page";

const ME = { first_name: "Ana", last_name: "Paz", plan: { code: "free", name: "Gratis" } };
const sp = { searchParams: Promise.resolve({}) };
const resumen = (status: string, id = SID) => ({ id, status, level: { id: "l", code: "junior", name: "Junior" }, recruiter: { id: "r", display_name: "Ana" } });

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
  function con(lista: unknown) {
    return stubFetch((c) => {
      if (c.url.endsWith("/api/v1/me")) return jsonRes(200, ME);
      if (c.url.endsWith("/api/v1/interviews")) return typeof lista === "number" ? jsonRes(lista) : jsonRes(200, lista);
      return jsonRes(404);
    });
  }
  it("una sesión in_progress -> «Retoma tu entrevista»", async () => {
    const { llamadas } = con([resumen("completed", "99999999-9999-4999-8999-999999999999"), resumen("in_progress")]);
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.resume") })).toHaveAttribute("href", `/interviews/${SID}`);
    expect(llamadas.find((c) => c.url.endsWith("/interviews"))!.headers.get("authorization")).toBe("Bearer acc-111");
  });
  it("una sesión pausada también se retoma", async () => {
    con([resumen("paused")]);
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.resume") })).toBeInTheDocument();
  });
  it("solo completadas o abandonadas -> «Practica una entrevista»", async () => {
    con([resumen("completed"), resumen("abandoned")]);
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.practice") })).toBeInTheDocument();
  });
  it("si la lista falla o no existe aún, no rompe: «Practica una entrevista»", async () => {
    con(404);
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.practice") })).toBeInTheDocument();
    cleanup();
    con({ no: "es lista" });
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.practice") })).toBeInTheDocument();
  });
});

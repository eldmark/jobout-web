/** BUG-012: si el módulo de la escena (o `three`) no carga, el avatar 2D queda y la sala sigue usable. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import InterviewerAvatar from "@/app/_components/InterviewerAvatar";

const intento = vi.fn();
// El `import()` dinámico rechaza, como cuando falta `three` en el bundle del navegador.
vi.mock("@/app/_components/avatar-scene", () => {
  intento();
  throw new Error("Cannot find module 'three'");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("InterviewerAvatar cuando la importación dinámica falla", () => {
  it("con WebGL disponible pero sin módulo de escena: muestra el círculo con la inicial, sin canvas visible ni errores", async () => {
    vi.stubGlobal("WebGL2RenderingContext", class {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<InterviewerAvatar name="Ana" state="idle" />);
    await waitFor(() => expect(intento).toHaveBeenCalled());
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("A");
    expect(container.querySelector(".avatar")).toHaveAttribute("data-mode", "fallback");
    expect(container.querySelector("canvas")).toHaveAttribute("hidden");
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

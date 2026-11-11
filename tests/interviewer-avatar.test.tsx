import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import { avatarPalette, initials, speakingDurationMs } from "@/lib/avatar/palette";
import InterviewerAvatar, { useAvatarState } from "@/app/_components/InterviewerAvatar";

const scene = { setState: vi.fn(), render: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
const create = vi.fn((..._a: unknown[]) => scene);
vi.mock("@/app/_components/avatar-scene", () => ({ createAvatarScene: (...a: unknown[]) => create(...a) }));

const reduced = (v: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: v && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("paleta por reclutador (pura)", () => {
  it("cada uno de los 5 tiene un look distinto", () => {
    const looks = ["Ana", "Martín", "Laura", "Carlos", "Sofía"].map((n) => JSON.stringify(avatarPalette(n)));
    expect(new Set(looks).size).toBe(5);
  });
  it("ignora acentos y mayúsculas; desconocido o vacío usa el valor por defecto", () => {
    expect(avatarPalette("MARTIN")).toEqual(avatarPalette("Martín"));
    expect(avatarPalette("Zoe")).toEqual(avatarPalette(""));
    expect(avatarPalette(undefined)).toEqual(avatarPalette("Zoe"));
    expect(avatarPalette("Zoe")).not.toEqual(avatarPalette("Ana"));
  });
  it("inicial y duración de habla acotada y proporcional", () => {
    expect(initials("ana")).toBe("A");
    expect(initials("  ")).toBe("?");
    expect(speakingDurationMs("a")).toBe(1500);
    expect(speakingDurationMs("x".repeat(60))).toBeLessThan(speakingDurationMs("x".repeat(100)));
    expect(speakingDurationMs("x".repeat(5000))).toBe(8000);
  });
});

describe("InterviewerAvatar sin WebGL (jsdom)", () => {
  it("muestra el avatar 2D, oculto a lectores, sin errores de consola", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<InterviewerAvatar name="Ana" state="idle" />);
    const f = screen.getByTestId("avatar-fallback");
    expect(f).toHaveTextContent("A");
    expect(f).toHaveAttribute("aria-hidden", "true");
    expect(create).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
  it("el estado se refleja en data-state", () => {
    const { container, rerender } = render(<InterviewerAvatar name="Ana" state="idle" />);
    const raiz = () => container.querySelector(".avatar")!;
    expect(raiz()).toHaveAttribute("data-state", "idle");
    rerender(<InterviewerAvatar name="Ana" state="thinking" />);
    expect(raiz()).toHaveAttribute("data-state", "thinking");
    rerender(<InterviewerAvatar name="Ana" state="speaking" />);
    expect(raiz()).toHaveAttribute("data-state", "speaking");
  });
});

describe("InterviewerAvatar con WebGL (three simulado)", () => {
  beforeEach(() => {
    vi.stubGlobal("WebGL2RenderingContext", class {});
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 7));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("monta el canvas aria-hidden y pasa la paleta y el estado", async () => {
    reduced(false);
    const { container } = render(<InterviewerAvatar name="Laura" state="thinking" />);
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]![1]).toEqual(avatarPalette("Laura"));
    expect(scene.setState).toHaveBeenCalledWith("thinking");
    const c = container.querySelector("canvas")!;
    expect(c).toHaveAttribute("aria-hidden", "true");
    await waitFor(() => expect(container.querySelector(".avatar")).toHaveAttribute("data-mode", "canvas"));
    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it("movimiento reducido: un solo fotograma y ningún bucle", async () => {
    reduced(true);
    const { container } = render(<InterviewerAvatar name="Ana" state="idle" />);
    await waitFor(() => expect(container.querySelector(".avatar")).toHaveAttribute("data-mode", "canvas"));
    expect(scene.render).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("al desmontar cancela el bucle y libera la escena", async () => {
    reduced(false);
    const { unmount, container } = render(<InterviewerAvatar name="Ana" state="idle" />);
    await waitFor(() => expect(container.querySelector(".avatar")).toHaveAttribute("data-mode", "canvas"));
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });

  it("si la escena falla, queda el avatar 2D sin romper", async () => {
    reduced(false);
    create.mockImplementationOnce(() => {
      throw new Error("no webgl");
    });
    render(<InterviewerAvatar name="Ana" state="idle" />);
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(screen.getByTestId("avatar-fallback")).toBeInTheDocument();
  });
});

describe("useAvatarState", () => {
  function Probe(p: { thinking: boolean; k: number | null; text: string }) {
    return <p data-testid="s">{useAvatarState(p.thinking, p.k, p.text)}</p>;
  }
  const estado = () => screen.getByTestId("s").textContent;

  it("habla por un tiempo proporcional al texto y vuelve a reposo", () => {
    vi.useFakeTimers();
    const texto = "x".repeat(60);
    const { rerender } = render(<Probe thinking={false} k={null} text="" />);
    expect(estado()).toBe("idle");
    rerender(<Probe thinking={false} k={1} text={texto} />);
    expect(estado()).toBe("speaking");
    act(() => void vi.advanceTimersByTime(speakingDurationMs(texto) - 1));
    expect(estado()).toBe("speaking");
    act(() => void vi.advanceTimersByTime(2));
    expect(estado()).toBe("idle");
  });
  it("pensar tiene prioridad, y el mismo turno no vuelve a hablar", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe thinking={false} k={1} text="hola" />);
    act(() => void vi.advanceTimersByTime(5000));
    rerender(<Probe thinking={true} k={1} text="hola" />);
    expect(estado()).toBe("thinking");
    rerender(<Probe thinking={false} k={1} text="hola" />);
    expect(estado()).toBe("idle");
  });
});

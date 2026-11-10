import { describe, it, expect } from "vitest";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("une clases y descarta las falsas", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });
  it("en un choque de Tailwind gana la última", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
  it("entiende los colores de la marca como colores", () => {
    expect(cn("text-ink", "text-coral")).toBe("text-coral");
    expect(cn("bg-indigo", "bg-lavender")).toBe("bg-lavender");
  });
});

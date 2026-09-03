export default function Home() {
  return (
    <main
      style={{
        maxWidth: "42rem",
        margin: "0 auto",
        padding: "6rem 1.5rem",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", margin: "0 0 0.5rem", letterSpacing: "-0.02em" }}>
        JobOut
      </h1>
      <p style={{ color: "var(--tenue)", fontSize: "1.125rem", margin: "0 0 2.5rem" }}>
        Preparate, practicá y llegá listo a la entrevista.
      </p>
      <p
        style={{
          border: "1px solid var(--borde)",
          borderRadius: "0.5rem",
          padding: "1rem 1.25rem",
          color: "var(--tenue)",
          fontSize: "0.9375rem",
        }}
      >
        Andamio inicial. La sala de entrevista y el dashboard llegan con sus fases.
      </p>
    </main>
  );
}

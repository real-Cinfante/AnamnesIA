import Link from "next/link";

// ── Landing page — AnamnesIA "Verdad Clínica" ─────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--cream)" }}>

      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-16"
        style={{
          backgroundColor: "rgba(248,246,242,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(228,221,211,0.6)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ backgroundColor: "var(--forest-800)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--forest-400)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
              <circle cx="20" cy="10" r="2"/>
            </svg>
          </div>
          <span className="font-display text-[18px] tracking-tight" style={{ color: "var(--ink)" }}>
            AnamnesIA
          </span>
        </div>

        <Link
          href="/consultas"
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-150"
          style={{
            backgroundColor: "var(--forest-800)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(28,61,47,0.2)",
          }}
        >
          Entrar
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative pt-40 pb-28 px-8 text-center overflow-hidden">

        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(78,168,125,0.12) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 animate-fade-in"
          style={{
            backgroundColor: "var(--forest-50)",
            border: "1px solid var(--forest-200)",
            color: "var(--forest-800)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
            style={{ backgroundColor: "var(--forest-400)" }}
            aria-hidden="true"
          />
          Documentación clínica con IA
        </div>

        {/* Headline */}
        <h1
          className="font-display text-[64px] leading-[1.05] tracking-tight mb-6 animate-fade-up"
          style={{ color: "var(--ink)", maxWidth: "800px", margin: "0 auto 24px" }}
        >
          Cada consulta,<br />
          <span
            style={{
              background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-400) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            documentada.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-lg leading-relaxed mb-10 animate-fade-up-delay"
          style={{ color: "var(--stone)", maxWidth: "540px", margin: "0 auto 40px" }}
        >
          Graba la consulta, obtén la transcripción y genera una historia clínica
          estructurada lista para tu revisión. En minutos.
        </p>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4 animate-fade-up-delay2">
          <Link
            href="/consultas"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full text-base font-semibold transition-all duration-150"
            style={{
              background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(28,61,47,0.3)",
            }}
          >
            Comenzar ahora
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
          <span className="text-sm" style={{ color: "var(--stone)" }}>
            Sin instalación. Corre local.
          </span>
        </div>
      </section>

      {/* Pain point cards */}
      <section className="px-8 pb-24">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-5">
          {[
            {
              stat:  "2h",
              label: "Diarias en papeleo",
              desc:  "Los médicos dedican un tercio de su jornada a documentación administrativa, tiempo que podría invertirse en los pacientes.",
              color: "#dc2626",
            },
            {
              stat:  "38%",
              label: "Registros incompletos",
              desc:  "Más de un tercio de las historias clínicas omiten información crítica por la presión del tiempo en consulta.",
              color: "#d97706",
            },
            {
              stat:  "0",
              label: "Trazabilidad automática",
              desc:  "Sin grabación de la consulta, se pierde el contexto exacto de lo que médico y paciente conversaron.",
              color: "var(--forest-800)",
            },
          ].map(({ stat, label, desc, color }) => (
            <div
              key={label}
              className="rounded-2xl p-6 flex flex-col gap-3"
              style={{
                backgroundColor: "var(--parchment)",
                border: "1px solid var(--border-warm)",
                boxShadow: "0 1px 4px rgba(17,23,20,0.05)",
              }}
            >
              <span
                className="font-display text-5xl"
                style={{ color, lineHeight: 1 }}
              >
                {stat}
              </span>
              <div>
                <p className="font-semibold text-[15px]" style={{ color: "var(--ink)" }}>
                  {label}
                </p>
                <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--stone)" }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section
        className="px-8 py-20"
        style={{ backgroundColor: "var(--parchment)", borderTop: "1px solid var(--border-warm)", borderBottom: "1px solid var(--border-warm)" }}
      >
        <div className="max-w-4xl mx-auto">
          <p
            className="text-xs font-semibold uppercase tracking-[0.12em] mb-3"
            style={{ color: "var(--forest-600)" }}
          >
            Flujo de trabajo
          </p>
          <h2
            className="font-display text-4xl mb-14"
            style={{ color: "var(--ink)" }}
          >
            Cómo funciona
          </h2>

          <div className="grid grid-cols-3 gap-8">
            {[
              {
                num:   "01",
                title: "Graba la consulta",
                desc:  "Inicia la grabación al comenzar la consulta. AnamnesIA captura todo el audio del médico y el paciente en tiempo real.",
              },
              {
                num:   "02",
                title: "Transcripción automática",
                desc:  "Whisper transcribe el audio con precisión, identificando cada intervención y asignando timestamps exactos.",
              },
              {
                num:   "03",
                title: "Historia clínica lista",
                desc:  "Claude genera automáticamente la historia clínica estructurada. Tú revisas, editas y validas en minutos.",
              },
            ].map(({ num, title, desc }) => (
              <div key={num} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono text-4xl font-medium"
                    style={{ color: "var(--forest-200)", lineHeight: 1 }}
                  >
                    {num}
                  </span>
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: "var(--border-warm)" }}
                    aria-hidden="true"
                  />
                </div>
                <h3
                  className="font-semibold text-[17px]"
                  style={{ color: "var(--ink)" }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--stone)" }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-8 py-24 text-center">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-6">
          <h2
            className="font-display text-4xl"
            style={{ color: "var(--ink)" }}
          >
            Empieza hoy.
          </h2>
          <p className="text-base" style={{ color: "var(--stone)" }}>
            Sin registro. Sin configuración compleja. Sólo graba, transcribe y valida.
          </p>
          <Link
            href="/consultas"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full text-base font-semibold transition-all duration-150"
            style={{
              background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-400) 100%)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(28,61,47,0.25)",
            }}
          >
            Ir al dashboard
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-8 py-6 text-center"
        style={{ borderTop: "1px solid var(--border-warm)" }}
      >
        <p className="text-xs font-mono" style={{ color: "var(--stone)" }}>
          AnamnesIA · v0.1.0 · MVP · Documentación clínica con IA
        </p>
      </footer>
    </div>
  );
}

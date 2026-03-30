/**
 * Utilidades para RUT chileno (módulo 11).
 */
export function validarRut(rut: string): boolean {
  const clean = normalizarRut(rut);
  if (!clean.includes("-")) return false;
  const [body, dv] = clean.split("-");
  if (!/^\d+$/.test(body) || body.length < 7) return false;
  let s = 0, m = 2;
  for (const c of body.split("").reverse()) {
    s += parseInt(c) * m;
    m = m < 7 ? m + 1 : 2;
  }
  const expected = 11 - (s % 11);
  const expectedDv = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);
  return dv === expectedDv;
}

export function normalizarRut(rut: string): string {
  return rut.replace(/\./g, "").replace(/\s/g, "").toUpperCase().trim();
}

export function formatearRut(rut: string): string {
  const clean = normalizarRut(rut);
  if (!clean.includes("-")) return clean;
  const [body, dv] = clean.split("-");
  let formatted = "";
  for (let i = 0; i < body.length; i++) {
    if (i > 0 && (body.length - i) % 3 === 0) formatted += ".";
    formatted += body[i];
  }
  return `${formatted}-${dv}`;
}

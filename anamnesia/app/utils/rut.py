"""Utilidades para validación y formateo de RUT chileno (módulo 11)."""

def validar_rut(rut: str) -> bool:
    clean = normalizar_rut(rut)
    if "-" not in clean:
        return False
    body, dv = clean.rsplit("-", 1)
    if not body.isdigit() or len(body) < 7:
        return False
    s, m = 0, 2
    for c in reversed(body):
        s += int(c) * m
        m = m + 1 if m < 7 else 2
    expected = 11 - (s % 11)
    if expected == 11:
        expected_dv = "0"
    elif expected == 10:
        expected_dv = "K"
    else:
        expected_dv = str(expected)
    return dv == expected_dv

def normalizar_rut(rut: str) -> str:
    return rut.replace(".", "").replace(" ", "").upper().strip()

def formatear_rut(rut: str) -> str:
    clean = normalizar_rut(rut)
    if "-" not in clean:
        return clean
    body, dv = clean.rsplit("-", 1)
    formatted = ""
    for i, c in enumerate(reversed(body)):
        if i > 0 and i % 3 == 0:
            formatted = "." + formatted
        formatted = c + formatted
    return f"{formatted}-{dv}"

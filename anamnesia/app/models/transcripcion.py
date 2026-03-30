from dataclasses import dataclass
from typing import Optional


@dataclass
class Segmento:
    id: str
    consulta_id: str
    hablante: str              # medico | paciente | medico_examen | sin_clasificar
    texto: str
    inicio_segundos: float
    fin_segundos: float
    orden: int
    created_at: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "consulta_id": self.consulta_id,
            "hablante": self.hablante,
            "texto": self.texto,
            "inicio_segundos": self.inicio_segundos,
            "fin_segundos": self.fin_segundos,
            "orden": self.orden,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Segmento":
        return cls(
            id=data["id"],
            consulta_id=data["consulta_id"],
            hablante=data["hablante"],
            texto=data["texto"],
            inicio_segundos=float(data["inicio_segundos"]),
            fin_segundos=float(data["fin_segundos"]),
            orden=int(data["orden"]),
            created_at=data.get("created_at", ""),
        )

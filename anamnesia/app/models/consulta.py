from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Consulta:
    id: str
    medico_id: str
    paciente_nombre: str
    fecha: str                    # ISO 8601
    estado: str                   # grabando | transcribiendo | generando | listo | error
    audio_path: Optional[str] = None
    duracion_segundos: Optional[int] = None
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "medico_id": self.medico_id,
            "paciente_nombre": self.paciente_nombre,
            "fecha": self.fecha,
            "estado": self.estado,
            "audio_path": self.audio_path,
            "duracion_segundos": self.duracion_segundos,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Consulta":
        return cls(
            id=data["id"],
            medico_id=data["medico_id"],
            paciente_nombre=data["paciente_nombre"],
            fecha=data["fecha"],
            estado=data["estado"],
            audio_path=data.get("audio_path"),
            duracion_segundos=data.get("duracion_segundos"),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
        )

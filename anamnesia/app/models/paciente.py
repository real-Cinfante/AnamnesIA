from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Paciente:
    id: str
    rut: str
    nombre: str
    fecha_nacimiento: Optional[str] = None
    sexo: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    perfil_clinico: dict = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "rut": self.rut,
            "nombre": self.nombre,
            "fecha_nacimiento": self.fecha_nacimiento,
            "sexo": self.sexo,
            "telefono": self.telefono,
            "email": self.email,
            "perfil_clinico": self.perfil_clinico,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Paciente":
        return cls(
            id=data["id"],
            rut=data["rut"],
            nombre=data["nombre"],
            fecha_nacimiento=data.get("fecha_nacimiento"),
            sexo=data.get("sexo"),
            telefono=data.get("telefono"),
            email=data.get("email"),
            perfil_clinico=data.get("perfil_clinico") or {},
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
        )

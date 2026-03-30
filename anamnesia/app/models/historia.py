from dataclasses import dataclass
from typing import Optional


@dataclass
class HistoriaClinica:
    id: str
    consulta_id: str
    anamnesis: str = ""
    antecedentes: str = ""
    examen_fisico: str = ""
    diagnostico_presuntivo: str = ""
    indicaciones: str = ""
    estado: str = "borrador"          # borrador | revisada | validada
    editada_por_medico: bool = False
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "consulta_id": self.consulta_id,
            "anamnesis": self.anamnesis,
            "antecedentes": self.antecedentes,
            "examen_fisico": self.examen_fisico,
            "diagnostico_presuntivo": self.diagnostico_presuntivo,
            "indicaciones": self.indicaciones,
            "estado": self.estado,
            "editada_por_medico": self.editada_por_medico,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "HistoriaClinica":
        return cls(
            id=data["id"],
            consulta_id=data["consulta_id"],
            anamnesis=data.get("anamnesis", ""),
            antecedentes=data.get("antecedentes", ""),
            examen_fisico=data.get("examen_fisico", ""),
            diagnostico_presuntivo=data.get("diagnostico_presuntivo", ""),
            indicaciones=data.get("indicaciones", ""),
            estado=data.get("estado", "borrador"),
            editada_por_medico=bool(data.get("editada_por_medico", False)),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
        )

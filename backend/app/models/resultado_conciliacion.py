from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, Numeric, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.ejecucion_proceso import EjecucionProceso


class ResultadoConciliacion(Base):
    __tablename__ = "resultados_conciliacion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ejecucion_id: Mapped[int] = mapped_column(
        ForeignKey("ejecuciones_proceso.id"),
        nullable=False,
    )
    clave_referencia: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    estado_resultado: Mapped[str] = mapped_column(String(50), nullable=False)
    datos_archivo_a_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    datos_archivo_b_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    diferencia_importe: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2),
        nullable=True,
    )
    requiere_revision: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )
    observacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
    )

    ejecucion: Mapped[EjecucionProceso] = relationship(
        back_populates="resultados_conciliacion",
    )

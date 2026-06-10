from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.ejecucion_proceso import EjecucionProceso


class Archivo(Base):
    __tablename__ = "archivos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ejecucion_id: Mapped[int] = mapped_column(
        ForeignKey("ejecuciones_proceso.id"),
        nullable=False,
    )
    tipo_archivo: Mapped[str] = mapped_column(String(80), nullable=False)
    nombre_original: Mapped[str] = mapped_column(String(255), nullable=False)
    ruta_storage: Mapped[str] = mapped_column(String(500), nullable=False)
    extension: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    ejecucion: Mapped[EjecucionProceso] = relationship(back_populates="archivos")

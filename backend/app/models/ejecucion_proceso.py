from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.archivo import Archivo
    from app.models.proceso import Proceso
    from app.models.usuario import Usuario


class EjecucionProceso(Base):
    __tablename__ = "ejecuciones_proceso"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    proceso_id: Mapped[int] = mapped_column(
        ForeignKey("procesos.id"),
        nullable=False,
    )
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id"),
        nullable=False,
    )
    estado: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="CARGADO",
        server_default="CARGADO",
    )
    resumen_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    proceso: Mapped[Proceso] = relationship(back_populates="ejecuciones")
    usuario: Mapped[Usuario] = relationship(back_populates="ejecuciones")
    archivos: Mapped[list[Archivo]] = relationship(back_populates="ejecucion")

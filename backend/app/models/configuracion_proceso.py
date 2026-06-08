from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.proceso import Proceso


class ConfiguracionProceso(Base):
    __tablename__ = "configuraciones_proceso"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    proceso_id: Mapped[int] = mapped_column(
        ForeignKey("procesos.id"),
        nullable=False,
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    activo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )
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

    proceso: Mapped[Proceso] = relationship(back_populates="configuraciones")

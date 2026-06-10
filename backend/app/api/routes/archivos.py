from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.database.session import get_db
from app.models import Archivo, EjecucionProceso, Usuario
from app.schemas.archivo import ArchivoRead
from app.services.file_service import get_extension, save_upload_file


router = APIRouter(prefix="/archivos", tags=["archivos"])


def ensure_ejecucion_exists(db: Session, ejecucion_id: int) -> None:
    if db.get(EjecucionProceso, ejecucion_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejecución no encontrada",
        )


@router.post(
    "/upload",
    response_model=ArchivoRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_archivo(
    ejecucion_id: int = Form(...),
    tipo_archivo: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> Archivo:
    ensure_ejecucion_exists(db, ejecucion_id)

    try:
        stored_file = save_upload_file(file, ejecucion_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    archivo = Archivo(
        ejecucion_id=ejecucion_id,
        tipo_archivo=tipo_archivo,
        nombre_original=file.filename or "archivo",
        ruta_storage=stored_file.relative_path,
        extension=get_extension(file.filename or "archivo"),
        mime_type=file.content_type,
        size_bytes=stored_file.size_bytes,
        checksum=stored_file.checksum,
    )
    db.add(archivo)
    db.commit()
    db.refresh(archivo)
    return archivo


@router.get("/ejecucion/{ejecucion_id}", response_model=list[ArchivoRead])
def list_archivos_por_ejecucion(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> list[Archivo]:
    ensure_ejecucion_exists(db, ejecucion_id)

    result = db.execute(
        select(Archivo)
        .where(Archivo.ejecucion_id == ejecucion_id)
        .order_by(Archivo.id),
    )
    return list(result.scalars().all())

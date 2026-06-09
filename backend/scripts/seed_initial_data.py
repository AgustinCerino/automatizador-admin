from pathlib import Path
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session


backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.security import get_password_hash
from app.database.session import SessionLocal
from app.models import Cliente, ConfiguracionProceso, Proceso, Usuario


DEMO_CONFIG = {
    "columna_clave_archivo_a": None,
    "columna_clave_archivo_b": None,
    "columna_importe_archivo_a": None,
    "columna_importe_archivo_b": None,
    "tolerancia_importe": 1.0,
    "detectar_duplicados": True,
    "permitir_diferencia_centavos": True,
    "campos_obligatorios": ["clave", "importe"],
}


def get_or_create_cliente(db: Session) -> Cliente:
    cliente = db.execute(
        select(Cliente).where(Cliente.nombre == "Cliente Demo"),
    ).scalar_one_or_none()

    if cliente is not None:
        print(f"Reutilizando cliente: {cliente.nombre} (id={cliente.id})")
        return cliente

    cliente = Cliente(
        nombre="Cliente Demo",
        cuit="20-00000000-0",
        estado="ACTIVO",
    )
    db.add(cliente)
    db.flush()
    print(f"Cliente creado: {cliente.nombre} (id={cliente.id})")
    return cliente


def get_or_create_usuario_admin(db: Session, cliente: Cliente) -> Usuario:
    usuario = db.execute(
        select(Usuario).where(Usuario.email == "admin@demo.com"),
    ).scalar_one_or_none()

    if usuario is not None:
        print(f"Reutilizando usuario: {usuario.email} (id={usuario.id})")
        return usuario

    usuario = Usuario(
        cliente_id=cliente.id,
        nombre="Admin Demo",
        email="admin@demo.com",
        password_hash=get_password_hash("admin123"),
        rol="ADMIN",
        estado="ACTIVO",
    )
    db.add(usuario)
    db.flush()
    print(f"Usuario creado: {usuario.email} (id={usuario.id})")
    return usuario


def get_or_create_proceso(db: Session, cliente: Cliente) -> Proceso:
    proceso = db.execute(
        select(Proceso).where(
            Proceso.cliente_id == cliente.id,
            Proceso.tipo == "CONCILIACION_EXCEL",
            Proceso.nombre == "Conciliación Excel",
        ),
    ).scalar_one_or_none()

    if proceso is not None:
        print(f"Reutilizando proceso: {proceso.nombre} (id={proceso.id})")
        return proceso

    proceso = Proceso(
        cliente_id=cliente.id,
        nombre="Conciliación Excel",
        tipo="CONCILIACION_EXCEL",
        descripcion="Proceso inicial para comparar dos planillas Excel.",
        estado="ACTIVO",
    )
    db.add(proceso)
    db.flush()
    print(f"Proceso creado: {proceso.nombre} (id={proceso.id})")
    return proceso


def get_or_create_configuracion(
    db: Session,
    proceso: Proceso,
) -> ConfiguracionProceso:
    configuracion = db.execute(
        select(ConfiguracionProceso).where(
            ConfiguracionProceso.proceso_id == proceso.id,
            ConfiguracionProceso.nombre
            == "Configuración inicial Conciliación Excel",
        ),
    ).scalar_one_or_none()

    if configuracion is not None:
        print(
            "Reutilizando configuración: "
            f"{configuracion.nombre} (id={configuracion.id})",
        )
        return configuracion

    configuracion = ConfiguracionProceso(
        proceso_id=proceso.id,
        nombre="Configuración inicial Conciliación Excel",
        config_json=DEMO_CONFIG,
        activo=True,
    )
    db.add(configuracion)
    db.flush()
    print(
        "Configuración creada: "
        f"{configuracion.nombre} (id={configuracion.id})",
    )
    return configuracion


def main() -> None:
    db = SessionLocal()
    try:
        cliente = get_or_create_cliente(db)
        get_or_create_usuario_admin(db, cliente)
        proceso = get_or_create_proceso(db, cliente)
        get_or_create_configuracion(db, proceso)

        db.commit()
        print("Seed inicial completado correctamente.")
    except Exception:
        db.rollback()
        print("Error al ejecutar el seed inicial. Se hizo rollback.")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

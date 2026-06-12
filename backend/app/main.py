from fastapi import FastAPI

from app.api.routes.archivos import router as archivos_router
from app.api.routes.auth import router as auth_router
from app.api.routes.clientes import router as clientes_router
from app.api.routes.conciliaciones import router as conciliaciones_router
from app.api.routes.ejecuciones import router as ejecuciones_router
from app.api.routes.health import router as health_router
from app.api.routes.procesos import router as procesos_router
from app.core.config import settings


app = FastAPI(title=settings.project_name)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(clientes_router)
app.include_router(procesos_router)
app.include_router(ejecuciones_router)
app.include_router(archivos_router)
app.include_router(conciliaciones_router)

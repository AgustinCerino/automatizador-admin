# Transformación Excel

## Objetivo y alcance

El módulo `TRANSFORMACION_EXCEL` transforma una fuente CSV, XLS o XLSX mediante una configuración validada y persistida por ejecución. El MVP incluye inspección, dry-run, generación XLSX, plantillas reutilizables, descarga, resumen operativo, trazabilidad y controles de integridad. No incluye frontend, macros, fórmulas libres, workers ni nuevas operaciones.

Las cinco operaciones disponibles son `SOURCE`, `CONSTANT`, `CONCAT`, `ARITHMETIC` y `VALUE_MAP`. El contrato discriminado está en `app/schemas/transformacion_excel.py`.

## Arquitectura

- `app/api/routes/transformaciones_excel.py`: endpoints y traducción de errores HTTP.
- `app/services/transformacion_excel_inspeccion_service.py`: lectura de fuentes, hojas, encabezados, tipos y preview.
- `app/services/transformacion_excel_config_service.py`: guardado y consulta de configuración en `EjecucionProceso.resumen_json`.
- `app/services/transformacion_excel_validation_service.py`: dry-run, métricas, muestras e integridad persistida.
- `app/services/transformacion_excel_pipeline.py`: motor puro compartido por validación y generación.
- `app/services/transformacion_excel_xlsx_writer.py`: salida XLSX atómica y neutralización de fórmulas en campos de texto.
- `app/services/transformacion_excel_generation_service.py`: reserva concurrente, generación, registro `EXCEL_OUTPUT`, idempotencia y descarga.
- `app/services/transformacion_excel_template_service.py`: plantillas almacenadas en `ConfiguracionProceso`.
- `app/services/transformacion_excel_operational_service.py`: resumen, issues, capacidades y acción requerida.
- `app/services/transformacion_excel_trace_service.py`: trazabilidad sanitizada dentro de `resumen_json`.
- `app/services/transformacion_excel_security_service.py`: rutas seguras, límites, preflight XLSX y checksums.

El pipeline aplica, en orden: filtros de filas, columnas de salida ordenadas por `position`, conversión y validación de datos, deduplicación, ordenamiento estable y retiro de columnas internas. El DataFrame fuente no se modifica.

## Configuración y estados

`TransformacionExcelConfig` contiene `source`, `output_columns`, `rows` y `output`. Admite hasta cinco filtros y tres criterios de ordenamiento. La configuración, validación, generación, plantilla aplicada y trazas se guardan bajo `resumen_json["transformacion_excel"]`; no se agregaron tablas ni columnas.

El flujo normal usa `CARGADO -> CONFIGURADO -> VALIDADO -> PROCESANDO -> COMPLETADO`. Un fallo técnico posterior a la reserva intenta dejar `ERROR`. Una validación con errores de datos vuelve a `CONFIGURADO`. También se respetan los estados terminales existentes `CANCELADO`, `APROBADO` y `RECHAZADO`.

La generación requiere una validación exitosa con checksum de fuente y configuración. Una validación histórica sin esos datos, o un cambio posterior, registra `VALIDATION_INVALIDATED`, limpia el resumen de generación, vuelve a `CONFIGURADO` y responde 409. La reserva `VALIDADO -> PROCESANDO` usa `SELECT ... FOR UPDATE` y libera la transacción antes de escribir el XLSX.

## Endpoints

- `GET /transformaciones-excel/archivos/{archivo_id}/estructura`
- `POST|GET /transformaciones-excel/{ejecucion_id}/configuracion`
- `POST /transformaciones-excel/{ejecucion_id}/validar`
- `POST /transformaciones-excel/{ejecucion_id}/generar`
- `GET /transformaciones-excel/{ejecucion_id}/resultado`
- `GET /transformaciones-excel/{ejecucion_id}/resultado/descargar`
- `GET /transformaciones-excel/{ejecucion_id}/resumen`
- `GET /transformaciones-excel/{ejecucion_id}/trazabilidad`
- `GET /transformaciones-excel/procesos/{proceso_id}/plantillas`
- `GET|PUT|DELETE /transformaciones-excel/plantillas/{plantilla_id}`
- `POST /transformaciones-excel/{ejecucion_id}/plantillas`
- `POST /transformaciones-excel/{ejecucion_id}/plantillas/{plantilla_id}/aplicar`

Todos exigen JWT. Crear, modificar y desactivar plantillas exige rol `ADMIN`; consultar y aplicar sigue las reglas de cliente y proceso del servicio. La descarga vuelve a validar estado, registro, extensión, existencia e inclusión de la ruta en storage, y envía `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store`.

## Storage, seguridad y límites

Los originales se guardan en `backend/storage/originals/{ejecucion_id}/` y los resultados en `backend/storage/processed/{ejecucion_id}/`. Las rutas persistidas se resuelven canónicamente dentro de `backend/storage`; se rechazan escapes, rutas absolutas externas y symlinks que salgan del storage. Las respuestas y trazas no incluyen rutas físicas.

Valores por defecto, todos enteros positivos y configurables por entorno:

| Variable | Default |
| --- | ---: |
| `TRANSFORMACION_EXCEL_MAX_FILE_SIZE_MB` | 50 |
| `TRANSFORMACION_EXCEL_MAX_ROWS` | 200000 |
| `TRANSFORMACION_EXCEL_MAX_COLUMNS` | 300 |
| `TRANSFORMACION_EXCEL_MAX_SHEETS` | 50 |
| `TRANSFORMACION_EXCEL_MAX_XLSX_UNCOMPRESSED_MB` | 250 |
| `TRANSFORMACION_EXCEL_MAX_XLSX_COMPRESSION_RATIO` | 100 |
| `TRANSFORMACION_EXCEL_STALE_PROCESSING_MINUTES` | 30 |

Para XLSX se inspecciona el ZIP sin extraerlo: integridad del contenedor, nombres de entrada, hojas, tamaño descomprimido y relación de compresión. El control de relación aplica desde 1 MiB descomprimido. CSV y XLS no reciben controles ZIP. Filas y columnas se cuentan después de leer el encabezado, antes del pipeline.

Errores principales: 400 para configuración, formato o contenedor inválido; 401/403 para autenticación o cliente/rol; 404 para recursos o archivos ausentes; 409 para estado incompatible o validación invalidada; 413 para tamaño, dimensiones o expansión XLSX. Los detalles controlados incluyen los códigos documentados por `transformacion_excel_security_service.py` y `transformacion_excel_generation_service.py`; los errores inesperados se presentan con mensajes genéricos y el error persistido se limita a 500 caracteres.

Un `PROCESANDO` cuyo último `GENERATION_STARTED` supera el umbral agrega `STALE_PROCESSING_STATE`, bloquea operaciones y recomienda `REVIEW_ERROR`. No cambia el estado automáticamente.

## Pruebas

Desde `backend/`, con las dependencias de `requirements.txt` instaladas:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

La suite integral usa exclusivamente `TEST_DATABASE_URL`. Nunca toma `DATABASE_URL` como fallback, rechaza que ambas cadenas sean iguales y se omite con un mensaje claro si falta la variable. Debe apuntar a PostgreSQL; se recomienda un nombre terminado en `_test`. Crea las tablas con `Base.metadata.create_all()` solo en esa base, aísla cada caso mediante rollback, reemplaza `get_db` y usa un storage temporal.

```powershell
$env:TEST_DATABASE_URL="postgresql+psycopg2://usuario:clave@localhost:5432/automatizador_admin_test"
.\.venv\Scripts\python.exe -m unittest tests.integration.test_transformacion_excel_api
```

## Prueba manual por Swagger

1. Iniciar el backend con el comando operativo vigente del proyecto y abrir `/docs`.
2. Autenticarse mediante `/auth/token` desde **Authorize** o usar el bearer obtenido por `/auth/login`.
3. Crear una ejecución para un proceso `TRANSFORMACION_EXCEL` y subir una fuente por `/archivos/upload`.
4. Inspeccionar estructura, guardar configuración y ejecutar el dry-run.
5. Confirmar `VALIDADO`, generar, consultar resultado y descargar el XLSX.
6. Abrir el archivo, consultar `/resumen` y verificar los eventos en `/trazabilidad`.

## Diagnóstico y limitaciones conocidas

Para diagnosticar, consultar primero `/resumen`, revisar `action_required` e `issues`, y luego `/trazabilidad`. Verificar el registro `Archivo` y el archivo físico sin copiar rutas a respuestas o trazas. Ante `VALIDATION_INVALIDATED`, repetir el dry-run. Ante `STALE_PROCESSING_STATE`, revisar el error operativo; no existe recuperación automática.

El storage sigue siendo local; no hay frontend, scheduler, worker, macros, OCR, integraciones externas ni lenguaje libre de fórmulas. Las pruebas integrales requieren una PostgreSQL de testing provista externamente. La estrategia de esquema continúa basada en los modelos y el script `create_all`; Alembic está configurado pero no hay revisiones versionadas.

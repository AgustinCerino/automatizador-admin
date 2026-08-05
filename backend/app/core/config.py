from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Automatizador Administrativo Web"
    database_url: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/"
        "automatizador_admin"
    )
    secret_key: str = "change-me-in-env"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    transformacion_excel_max_file_size_mb: int = Field(default=50, gt=0)
    transformacion_excel_max_rows: int = Field(default=200000, gt=0)
    transformacion_excel_max_columns: int = Field(default=300, gt=0)
    transformacion_excel_max_sheets: int = Field(default=50, gt=0)
    transformacion_excel_max_xlsx_uncompressed_mb: int = Field(
        default=250,
        gt=0,
    )
    transformacion_excel_max_xlsx_compression_ratio: int = Field(
        default=100,
        gt=0,
    )
    transformacion_excel_stale_processing_minutes: int = Field(
        default=30,
        gt=0,
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

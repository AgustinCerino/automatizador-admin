from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Automatizador Administrativo Web"
    database_url: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/"
        "automatizador_admin"
    )

    model_config = SettingsConfigDict(
                                        env_file=".env",
                                        env_file_encoding="utf-8",
                                        extra="ignore",
                                       )


settings = Settings()

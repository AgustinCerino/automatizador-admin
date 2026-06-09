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

    model_config = SettingsConfigDict(
                                        env_file=".env",
                                        env_file_encoding="utf-8",
                                        extra="ignore",
                                       )


settings = Settings()

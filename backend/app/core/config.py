from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Automatizador Administrativo Web"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

"""Application configuration using Pydantic Settings."""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./acadsync.db"

    # JWT
    JWT_SECRET: str = "acadsync-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # File uploads
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

    # Demo mode (shows OTP in response)
    DEMO_MODE: bool = True

    # App
    APP_NAME: str = "AcadSync"
    APP_VERSION: str = "1.0.0"

    # OAuth
    GOOGLE_CLIENT_ID: str = ""
    FACEBOOK_APP_ID: str = ""
    FACEBOOK_APP_SECRET: str = ""

    # Email Settings
    GMAIL_SMTP_HOST: str = "smtp.gmail.com"
    GMAIL_SMTP_PORT: int = 587
    GMAIL_EMAIL: str = ""
    GMAIL_APP_PASSWORD: str = ""
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "no-reply@acadsync.edu.ph"
    BREVO_SENDER_NAME: str = "AcadSync System"
    EMAIL_PROVIDER: str = "gmail"


    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str

    secret_key: str
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    admin_email: str
    admin_password: str
    admin_name: str = "Admin"

    # Bolna AI
    bolna_api_key: str = ""
    bolna_reminder_agent_id: str = ""
    bolna_renewal_agent_id: str = ""
    bolna_lead_agent_id: str = ""
    bolna_inbound_agent_id: str = ""
    bolna_inbound_phone: str = ""
    default_location_id: str = ""
    bolna_webhook_secret: str = ""

    # WhatsApp (Phase 4)
    whatsapp_phone_number_id: str = ""
    whatsapp_access_token: str = ""
    whatsapp_verify_token: str = ""

    # Google Calendar (Phase 2.5)
    google_calendar_credentials_json: str = ""
    google_calendar_id: str = ""

    sentry_dsn: str = ""

    # SaaS onboarding
    signup_invite_secret: str = ""
    frontend_url: str = "http://localhost:3000"

    # Meta WhatsApp Embedded Signup (optional — for Connect WhatsApp button)
    meta_app_id: str = ""
    meta_embedded_signup_config_id: str = ""

    # AI WhatsApp assistant — answers inbound chats and books appointments via tool-calling
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"


settings = Settings()

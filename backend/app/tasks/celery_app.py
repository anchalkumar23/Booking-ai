from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "booking_ai",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.bolna_tasks",
        "app.tasks.scheduled_tasks",
        "app.tasks.whatsapp_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_max_retries=3,
    beat_schedule={
        # Daily at 9am IST — check memberships expiring in 7, 3, 1 days
        "check-expiring-memberships": {
            "task": "app.tasks.scheduled_tasks.check_expiring_memberships",
            "schedule": crontab(hour=9, minute=0),
        },
        # Every 15 minutes — schedule reminders for upcoming appointments
        "schedule-appointment-reminders": {
            "task": "app.tasks.scheduled_tasks.schedule_appointment_reminders",
            "schedule": crontab(minute="*/15"),
        },
    },
)

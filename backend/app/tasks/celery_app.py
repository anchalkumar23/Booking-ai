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
    broker_connection_retry_on_startup=True,
    # Redis re-delivers any task not acked within visibility_timeout (default 1 hour).
    # Short-countdown call tasks are fine, but anything held longer than an hour was being
    # re-delivered every hour, flooding the worker. Raise it above our longest delay.
    # (Multi-day WhatsApp steps are now DB-polled instead — see dispatch_due_wa_steps —
    # so nothing legitimately sits in the queue for days; this is just a safety margin.)
    broker_transport_options={"visibility_timeout": 7200},  # 2 hours
    result_backend_transport_options={"visibility_timeout": 7200},
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
        # Every 5 minutes — send any WhatsApp sequence steps that are now due.
        # Multi-day steps live in the DB (lead_sequence_steps.scheduled_at), not as
        # long-lived Celery ETA tasks, so they survive worker restarts and never churn.
        "dispatch-due-wa-steps": {
            "task": "app.tasks.whatsapp_tasks.dispatch_due_wa_steps",
            "schedule": crontab(minute="*/5"),
        },
        # Every minute — fire staggered outbound calls that are now due.
        # Bulk lead/campaign calls live in the DB (scheduled_calls.due_at) rather than
        # as Celery countdown tasks, so a worker restart mid-campaign never drops them.
        "dispatch-due-calls": {
            "task": "app.tasks.bolna_tasks.dispatch_due_calls",
            "schedule": crontab(minute="*"),
        },
        # Every minute — send queued WhatsApp broadcast messages that are now due.
        # Rows live in the DB (scheduled_messages.due_at), so a broadcast survives
        # worker restarts and never double-sends.
        "dispatch-due-messages": {
            "task": "app.tasks.whatsapp_tasks.dispatch_due_messages",
            "schedule": crontab(minute="*"),
        },
    },
)

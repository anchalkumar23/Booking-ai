import logging
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
from app.tasks.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.appointment import Appointment, AppointmentStatus
from app.models.membership import Membership, PaymentStatus
from app.models.customer import Customer
from app.models.location import Location
from app.models.staff import Staff
from app.integrations.whatsapp import location_agent_variables

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")


@celery_app.task(name="app.tasks.scheduled_tasks.schedule_appointment_reminders")
def schedule_appointment_reminders():
    """
    Runs every 15 minutes.
    Finds appointments starting in 30-75 minutes and triggers reminder calls
    for those that haven't been reminded yet.
    """
    from app.tasks.bolna_tasks import send_reminder_call

    db = SessionLocal()
    try:
        now = datetime.now(IST)
        window_start = now + timedelta(minutes=30)
        window_end = now + timedelta(minutes=75)

        appointments = db.query(Appointment).filter(
            Appointment.status == AppointmentStatus.scheduled,
            Appointment.reminder_sent == False,
            Appointment.scheduled_at >= window_start,
            Appointment.scheduled_at <= window_end,
        ).all()

        for appt in appointments:
            customer = db.query(Customer).filter(Customer.id == appt.customer_id).first()
            if not customer or customer.is_suppressed or customer.is_dnd:
                continue

            location = db.query(Location).filter(Location.id == appt.location_id).first()
            staff = db.query(Staff).filter(Staff.id == appt.staff_id).first() if appt.staff_id else None

            variables = {
                **location_agent_variables(location),
                "customer_name": customer.full_name,
                "service": appt.service,
                "scheduled_at": appt.scheduled_at.astimezone(IST).strftime("%d %B %Y at %I:%M %p"),
                "staff_name": staff.full_name if staff else "our staff",
                "language": customer.language.value,
            }

            send_reminder_call.delay(
                appointment_id=str(appt.id),
                phone=customer.phone,
                variables=variables,
            )
            # Mark reminder sent immediately to prevent duplicate calls
            appt.reminder_sent = True
            db.commit()
            logger.info(f"Reminder call queued for appointment {appt.id}")

    finally:
        db.close()


@celery_app.task(name="app.tasks.scheduled_tasks.check_expiring_memberships")
def check_expiring_memberships():
    """
    Runs daily at 9am IST.
    Finds memberships expiring in exactly 7, 3, or 1 days
    and triggers renewal calls for those with pending payment.
    """
    from app.tasks.bolna_tasks import send_renewal_call

    db = SessionLocal()
    try:
        today = date.today()
        target_days = [1, 3, 7]

        for days in target_days:
            target_date = today + timedelta(days=days)

            memberships = db.query(Membership).filter(
                Membership.expires_at == target_date,
                Membership.payment_status == PaymentStatus.pending,
                Membership.renewal_call_sent == False,
            ).all()

            for membership in memberships:
                customer = db.query(Customer).filter(
                    Customer.id == membership.customer_id
                ).first()
                if not customer or customer.is_suppressed or customer.is_dnd:
                    continue

                location = db.query(Location).filter(
                    Location.id == membership.location_id
                ).first()

                variables = {
                    **location_agent_variables(location),
                    "customer_name": customer.full_name,
                    "tier": membership.tier,
                    "expires_at": membership.expires_at.strftime("%d %B %Y"),
                    "language": customer.language.value,
                }

                send_renewal_call.delay(
                    membership_id=str(membership.id),
                    phone=customer.phone,
                    variables=variables,
                )
                # Prevent duplicate renewal calls
                membership.renewal_call_sent = True
                db.commit()
                logger.info(
                    f"Renewal call queued for membership {membership.id} "
                    f"(expires in {days} days)"
                )

    finally:
        db.close()

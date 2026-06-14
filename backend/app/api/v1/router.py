from fastapi import APIRouter
from app.api.v1 import auth, locations, staff, customers, appointments, leads, analytics, inbound, memberships, calls, portal
from app.api.v1.webhooks import bolna as bolna_webhook
from app.api.v1.webhooks import whatsapp as whatsapp_webhook

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(locations.router)
router.include_router(staff.router)
router.include_router(customers.router)
router.include_router(appointments.router)
router.include_router(leads.router)
router.include_router(analytics.router)
router.include_router(memberships.router)
router.include_router(calls.router)
router.include_router(portal.router)
router.include_router(bolna_webhook.router)
router.include_router(whatsapp_webhook.router)
router.include_router(inbound.router)

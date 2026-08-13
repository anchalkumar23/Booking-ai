import csv
import io
import uuid
import openpyxl
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.promo_campaign import PromoCampaign
from app.schemas.promo_campaign import CampaignCreate, CampaignPreview, CampaignOut
from app.services.promo_campaign import (
    create_and_launch_campaign,
    launch_campaign_from_contacts,
    preview_audience,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=List[CampaignOut])
def list_campaigns(
    location_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    q = db.query(PromoCampaign)
    if location_id:
        q = q.filter(PromoCampaign.location_id == location_id)
    return q.order_by(PromoCampaign.created_at.desc()).all()


@router.post("/preview")
def preview_campaign(
    body: CampaignPreview,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Return how many contacts this audience would reach, before launching."""
    count = preview_audience(
        db,
        location_id=body.location_id,
        audience=body.audience,
        tier=body.tier,
        expiring_days=body.expiring_days,
        lead_status=body.lead_status,
    )
    return {"count": count}


@router.post("", response_model=CampaignOut, status_code=201)
def create_campaign(
    body: CampaignCreate,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Create a promotional campaign and immediately queue staggered calls."""
    return create_and_launch_campaign(
        db=db,
        location_id=body.location_id,
        name=body.name,
        message=body.message,
        audience=body.audience,
        tier=body.tier,
        expiring_days=body.expiring_days,
        lead_status=body.lead_status,
    )


@router.post("/import", response_model=CampaignOut, status_code=201)
async def import_campaign(
    location_id: uuid.UUID,
    name: str = Form(...),
    message: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Launch a promo call campaign from an uploaded CSV or Excel contact list.
    Required column: phone. Optional: full_name (or name)."""
    filename = (file.filename or "").lower()
    if not (filename.endswith(".csv") or filename.endswith(".xlsx")):
        raise HTTPException(
            status_code=400,
            detail={"message": "Only CSV or Excel (.xlsx) files are accepted.", "code": "invalid_file"},
        )

    content = await file.read()
    rows: list[dict] = []
    try:
        if filename.endswith(".xlsx"):
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            headers = [str(c.value).strip().lower() if c.value else "" for c in next(ws.iter_rows(min_row=1, max_row=1))]
            for excel_row in ws.iter_rows(min_row=2, values_only=True):
                rows.append({headers[i]: (str(v).strip() if v is not None else "") for i, v in enumerate(excel_row)})
            wb.close()
        else:
            text = content.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            rows = [{(k or "").strip().lower(): v for k, v in r.items()} for r in reader]
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={"message": f"Could not parse file: {e}", "code": "parse_error"},
        )

    if not rows:
        raise HTTPException(
            status_code=400,
            detail={"message": "File is empty.", "code": "empty_file"},
        )

    return launch_campaign_from_contacts(
        db=db, location_id=location_id, name=name, message=message, rows=rows,
    )

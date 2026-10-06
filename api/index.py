from fastapi import FastAPI

### Create FastAPI instance with custom docs and openapi url
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

@app.get("/api/py/helloFastApi")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}
from pydantic import BaseModel, Field
from fastapi import HTTPException
from recommender import analyze_food_waste, load_food_database
from pathlib import Path

class WasteRequest(BaseModel):
    waste_entries: list[tuple[str, float, str]] = Field(max_length=2000)
    served_data: dict[str, float]
    menu_items: list[str | dict] | None = None
    aliases: dict[str, str] = Field(default_factory=dict)
    threshold: float = Field(default=0.20, ge=0, le=1)

@app.post('/api/py/recommendations')
def recommendations(payload: WasteRequest):
    try:
        database = load_food_database(str(Path(__file__).resolve().parents[1] / 'database.json'))
        entries = []
        for name, amount, dietary in payload.waste_entries:
            name = payload.aliases.get(name, name)
            database[name] = {**database.get(name, {}), 'dietary': dietary}
            entries.append((name, amount))
        served = {}
        for name, amount in payload.served_data.items():
            name = payload.aliases.get(name, name)
            served[name] = served.get(name, 0) + amount
        return analyze_food_waste(entries, served, database, threshold=payload.threshold)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

from api.waste import WasteService, MOCK_SERVICE, financial_summary, calculate_item
from recommender import analyze_waste_vectors

def service_response(service: WasteService, simulated=False):
    return {'hall': service.hall, 'date': service.date, 'meal': service.meal,
            'data_source': 'illustrative mock' if simulated else 'submitted measurements',
            'items': [calculate_item(item) for item in service.items],
            'summary': financial_summary(service.items).model_dump(),
            'recommendations': analyze_waste_vectors(service.items)}

@app.get('/api/py/waste/mock')
def mock_waste():
    return service_response(MOCK_SERVICE, simulated=True)

@app.post('/api/py/waste/analyze')
def analyze_service(service: WasteService):
    try:
        return service_response(service)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

# MHacks Demo only; existing endpoints above are unchanged.
from datetime import date as Date
from typing import Literal
import logging
import httpx
from api.demo_store import query_observations, summarize
from api.demo_config import connection_error

@app.get('/api/py/demo/waste')
def demo_waste(service_date: Date,
               meal: Literal['all', 'breakfast', 'brunch', 'lunch', 'dinner'] = 'all'):
    try:
        rows = query_observations(service_date.isoformat(), meal)
        return dict(dining_hall='MHacks Demo', service_date=service_date.isoformat(),
                    meal=meal, inference='mock', observations=rows, **summarize(rows))
    except (httpx.HTTPError, KeyError, ValueError, TypeError, OverflowError) as exc:
        logging.exception('Demo database read failed')
        raise HTTPException(status_code=502,
                            detail=connection_error(exc))

# Live observations for the existing Home/Finances/Recommendations dashboards.
from api.demo_store import query_observations_range, food_specs

@app.get('/api/py/demo/waste/range')
def demo_waste_range(date_from: Date, date_to: Date):
    if not 0 <= (date_to - date_from).days <= 89:
        raise HTTPException(status_code=422, detail='Demo range must be 1–90 days')
    try:
        rows = query_observations_range(date_from.isoformat(), date_to.isoformat())
        # Validate rows and configured costs before returning the UI payload.
        result = summarize(rows)
        return dict(dining_hall='MHacks Demo', inference='mock',
                    observations=rows, food_specs=food_specs(rows), **result)
    except (httpx.HTTPError, KeyError, ValueError, TypeError, OverflowError) as exc:
        logging.exception('Demo range read failed')
        raise HTTPException(status_code=502,
                            detail=connection_error(exc))


@app.get('/api/py/demo/health')
def demo_health():
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    today = datetime.now(ZoneInfo('America/New_York')).date()
    try:
        rows = query_observations_range((today - timedelta(days=89)).isoformat(), today.isoformat())
        return dict(connected=True, dining_hall='MHacks Demo', demo_rows=len(rows),
                    dates=sorted({r['service_date'] for r in rows}),
                    meals=sorted({r['meal'] for r in rows}),
                    message='Connected; no MHacks Demo rows yet' if not rows else 'Connected; demo rows available')
    except (httpx.HTTPError, KeyError, ValueError, TypeError, OverflowError) as exc:
        logging.exception('Demo health check failed')
        raise HTTPException(status_code=502, detail=connection_error(exc))

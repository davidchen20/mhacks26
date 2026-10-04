from fastapi import FastAPI

### Create FastAPI instance with custom docs and openapi url
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

@app.get("/api/py/helloFastApi")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}
from pydantic import BaseModel, Field
from fastapi import HTTPException
from recommender import analyze_food_waste, load_food_database

class WasteRequest(BaseModel):
    waste_entries: list[tuple[str, float] | tuple[str, float, str]] = Field(max_length=2000)
    served_data: dict[str, float]
    menu_items: list[str | dict] | None = None
    aliases: dict[str, str] = Field(default_factory=dict)
    threshold: float = Field(default=0.20, ge=0, le=1)

@app.post('/api/py/recommendations')
def recommendations(payload: WasteRequest):
    try:
        return analyze_food_waste([(row[0], row[1]) for row in payload.waste_entries],
                                 payload.served_data, load_food_database('database.json'),
                                 threshold=payload.threshold)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

from api.waste import WasteService, MOCK_SERVICE, financial_summary, calculate_item
from api.recommendation_adapter import analyze_waste_vectors

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

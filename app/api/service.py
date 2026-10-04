"""Internal HTTP entrypoint for the existing recommendation worker."""
from fastapi import FastAPI, HTTPException
from recommender_worker import generate_recommendations

app = FastAPI()


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/recommendations')
def recommendations(payload: dict):
    try:
        return generate_recommendations(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

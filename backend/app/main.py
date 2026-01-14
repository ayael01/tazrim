from fastapi import FastAPI

app = FastAPI(title="Tazrim")


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}

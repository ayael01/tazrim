from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.imports import router as imports_router
from app.api.categories import router as categories_router
from app.api.merchants import router as merchants_router
from app.api.transactions import router as transactions_router
from app.api.reports import router as reports_router
from app.api.bank_imports import router as bank_imports_router
from app.api.bank_categories import router as bank_categories_router
from app.api.bank_payees import router as bank_payees_router
from app.api.bank_activities import router as bank_activities_router
from app.api.bank_reports import router as bank_reports_router

app = FastAPI(title="Tazrim")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(imports_router, prefix="/imports", tags=["imports"])
app.include_router(categories_router, prefix="/categories", tags=["categories"])
app.include_router(merchants_router, prefix="/merchants", tags=["merchants"])
app.include_router(transactions_router, prefix="/transactions", tags=["transactions"])
app.include_router(reports_router, prefix="/reports", tags=["reports"])
app.include_router(bank_imports_router, prefix="/bank/imports", tags=["bank"])
app.include_router(bank_categories_router, prefix="/bank/categories", tags=["bank"])
app.include_router(bank_payees_router, prefix="/bank/payees", tags=["bank"])
app.include_router(bank_activities_router, prefix="/bank/activities", tags=["bank"])
app.include_router(bank_reports_router, prefix="/bank/reports", tags=["bank"])


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}

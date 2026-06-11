#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from threading import Lock, Thread
from time import monotonic

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


app = FastAPI(title="TRPG World State Pipeline", version="1.0.0")
model_state = {"status": "pending", "load_seconds": None, "error": None}
model_state_lock = Lock()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def disable_browser_cache(request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


app.mount("/static", StaticFiles(directory="frontend"), name="static")


class PipelineRequest(BaseModel):
    text: str = Field(..., min_length=1)
    max_chars: int = Field(1200, ge=300, le=3000)


def warm_coref_model():
    started = monotonic()
    with model_state_lock:
        model_state.update(status="loading", load_seconds=None, error=None)

    try:
        from utils.text_processor import get_coref_predictor

        get_coref_predictor()
        with model_state_lock:
            model_state.update(
                status="ready",
                load_seconds=round(monotonic() - started, 1),
                error=None,
            )
    except Exception as exc:
        with model_state_lock:
            model_state.update(
                status="error",
                load_seconds=round(monotonic() - started, 1),
                error=str(exc),
            )


@app.on_event("startup")
def start_model_warmup():
    if os.getenv("COREF_PRELOAD", "1") == "1":
        Thread(target=warm_coref_model, name="coref-model-warmup", daemon=True).start()
    else:
        with model_state_lock:
            model_state.update(status="on_demand", load_seconds=None, error=None)


@app.get("/")
def index():
    return FileResponse("frontend/index.html")


@app.get("/api/health")
def health():
    with model_state_lock:
        coref_model = dict(model_state)
    return {"status": "ok", "coref_model": coref_model}


@app.post("/api/world-state")
def create_world_state(request: PipelineRequest):
    with model_state_lock:
        current_model_status = model_state["status"]

    if current_model_status in {"pending", "loading"}:
        raise HTTPException(
            status_code=503,
            detail="SpanBERT is still warming up. Wait for the model status to become ready.",
        )
    if current_model_status == "error":
        raise HTTPException(status_code=500, detail=model_state["error"])

    try:
        from pipeline import run_pipeline_from_text

        return run_pipeline_from_text(request.text, max_chars=request.max_chars)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

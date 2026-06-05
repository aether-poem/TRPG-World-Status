#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


app = FastAPI(title="TRPG World State Pipeline", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend"), name="static")


class PipelineRequest(BaseModel):
    text: str = Field(..., min_length=1)
    max_chars: int = Field(1200, ge=300, le=3000)


@app.get("/")
def index():
    return FileResponse("frontend/index.html")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/world-state")
def create_world_state(request: PipelineRequest):
    try:
        from pipeline import run_pipeline_from_text

        return run_pipeline_from_text(request.text, max_chars=request.max_chars)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .routers import auth_routes, cameras, detect, events, health, stream
from .ws import broadcaster_loop, ws_endpoint

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

DEFAULT_ERROR_CODES = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    503: "DEPENDENCY_UNAVAILABLE",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(broadcaster_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="HelmetWatch API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        payload = {
            "code": detail.get("code"),
            "message": detail.get("message", str(detail)),
            "details": detail.get("details"),
        }
    else:
        payload = {
            "code": DEFAULT_ERROR_CODES.get(exc.status_code, "ERROR"),
            "message": str(detail),
            "details": None,
        }
    return JSONResponse(status_code=exc.status_code, content={"error": payload})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Data permintaan tidak valid",
                "details": exc.errors(),
            }
        },
    )


app.include_router(auth_routes.router)
app.include_router(cameras.router)
app.include_router(events.router)
app.include_router(detect.router)
app.include_router(stream.router)
app.include_router(health.router)
app.add_api_websocket_route("/ws", ws_endpoint)

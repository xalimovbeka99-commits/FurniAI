"""Vercel entry point for the deterministic FurniAI production engine.

The browser sends the frozen configurator state to this endpoint. The endpoint
translates that state into FurniSpec millimetres, runs deterministic inspection,
and returns a ZIP factory-review pack only when all software engineering gates
pass. Physical factory qualification is deliberately never granted here.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import tempfile
import zipfile
import copy
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
ENGINE_DIR = ROOT_DIR / "production-engine" / "furniai_engine"
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))

import furniai  # noqa: E402
import inspector  # noqa: E402


MAX_REQUEST_BYTES = 64 * 1024
MAX_RESPONSE_BYTES = 4_300_000

TYPE_MAP = {
    "wardrobe": "wardrobe",
    "kitchen": "kitchen",
    "vanity_freestanding": "vanity",
    "vanity_floating": "vanity",
    "bookshelf": "shelving",
    "sideboard": "console",
}

UNSUPPORTED_TYPES = {
    "walkin_l": "L-shaped walk-ins need separate run lengths and a qualified corner-unit rule.",
    "walkin_u": "U-shaped walk-ins need three separate run lengths and qualified corner-unit rules.",
    "kitchen_l": "L-shaped kitchens need separate run lengths and a qualified corner-cabinet strategy.",
    "kitchen_u": "U-shaped kitchens need three separate run lengths and qualified corner-cabinet strategies.",
    "kitchen_island": "Kitchen-and-island projects need separate wall-run and island specifications.",
    "custom": "Freeform AI geometry is not yet accepted by the deterministic factory engine.",
}

MATERIAL_MAP = {
    "oak": "oak",
    "walnut": "walnut",
    "white": "white",
    "grey": "graphite",
    "taupe": "beige",
    "cream": "linen",
    "black": "black",
    "navy": "navy",
    "sage": "sage",
    "mahogany": "mahogany",
}

HANDLE_MAP = {
    "gold": "gold_bar",
    "black": "black_strip",
    "chrome": "chrome",
    "push": "hidden_push",
    "none": "none",
}

DOOR_STYLE_MAP = {
    "solid": "solid_panel",
    "glass": "glass_panel",
    "mirror": "full_mirror",
    "open": None,
}

ZONE_MAP = {
    "dubai": "dubai",
    "abu dhabi": "abu_dhabi",
    "sharjah": "sharjah",
    "ajman / northern emirates": "ajman",
    "other uae": "other_uae",
}


class ProductionRequestError(ValueError):
    """A safe, user-correctable production request error."""

    def __init__(self, message: str, *, code: str = "INVALID_CONFIGURATION"):
        super().__init__(message)
        self.code = code


def _bounded_int(
    value: Any,
    *,
    field: str,
    minimum: int,
    maximum: int,
) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError) as exc:
        raise ProductionRequestError(f"{field} must be a number.") from exc
    if number < minimum or number > maximum:
        raise ProductionRequestError(
            f"{field} must be between {minimum} and {maximum}."
        )
    return number


def _millimetres(config: dict[str, Any], short_key: str, long_key: str) -> int:
    if short_key in config:
        return _bounded_int(
            float(config[short_key]) * 10,
            field=long_key,
            minimum=150,
            maximum=8000,
        )
    return _bounded_int(
        config.get(long_key),
        field=long_key,
        minimum=150,
        maximum=8000,
    )


def _door_front(door_type: str) -> dict[str, Any] | None:
    style = DOOR_STYLE_MAP.get(door_type)
    if style is None:
        return None
    return {"kind": "door", "leaves": 1, "style": style}


def _wardrobe_bays(
    sections: int,
    drawers: int,
    shelves: int,
    door_type: str,
) -> list[dict[str, Any]]:
    bays: list[dict[str, Any]] = []
    front = _door_front(door_type)
    for index in range(sections):
        modules: list[dict[str, Any]] = []
        if drawers and index == 0:
            drawer_height = max(300, min(900, drawers * 180))
            modules.append(
                {
                    "type": "drawers",
                    "height": drawer_height,
                    "rows": drawers,
                    "front": {"kind": "drawer_faces"},
                }
            )
        remaining = {
            "type": "shelves" if shelves else "hanging",
            "height": "fill",
        }
        if shelves:
            remaining["count"] = shelves
        if front:
            remaining["front"] = dict(front)
        modules.append(remaining)
        bays.append({"width": None, "modules": modules})
    return bays


def _shelving_bays(sections: int, shelves: int) -> list[dict[str, Any]]:
    return [
        {
            "width": None,
            "modules": [
                {"type": "shelves", "height": "fill", "count": max(1, shelves)}
            ],
        }
        for _ in range(sections)
    ]


def _console_bays(
    sections: int,
    drawers: int,
    shelves: int,
    door_type: str,
) -> list[dict[str, Any]]:
    front = _door_front(door_type)
    bays: list[dict[str, Any]] = []
    for index in range(sections):
        if drawers and index % 2 == 1:
            modules = [
                {
                    "type": "drawers",
                    "height": "fill",
                    "rows": drawers,
                    "front": {"kind": "drawer_faces"},
                }
            ]
        else:
            module: dict[str, Any] = {
                "type": "shelves",
                "height": "fill",
                "count": shelves,
            }
            if front:
                module["front"] = dict(front)
            modules = [module]
        bays.append({"width": None, "modules": modules})
    return bays


def _vanity_bays(
    sections: int,
    drawers: int,
    shelves: int,
    door_type: str,
) -> list[dict[str, Any]]:
    front = _door_front(door_type)
    bays: list[dict[str, Any]] = []
    for index in range(sections):
        has_drawers = bool(drawers) and (
            sections == 1
            or (sections == 2 and index == 0)
            or (sections == 3 and index != 1)
            or (sections >= 4 and index in (0, sections - 1))
        )
        if has_drawers:
            modules = [
                {
                    "type": "drawers",
                    "height": "fill",
                    "rows": min(3, drawers),
                    "front": {"kind": "drawer_faces"},
                }
            ]
        else:
            module: dict[str, Any] = {
                "type": "shelves",
                "height": "fill",
                "count": shelves,
            }
            if front:
                module["front"] = dict(front)
            modules = [module]
        bays.append({"width": None, "modules": modules})
    return bays


def frontend_config_to_spec(payload: dict[str, Any]) -> dict[str, Any]:
    config = payload.get("config", payload)
    if not isinstance(config, dict):
        raise ProductionRequestError("config must be a JSON object.")

    frontend_type = str(config.get("type", "")).strip().lower()
    if frontend_type in UNSUPPORTED_TYPES:
        raise ProductionRequestError(
            UNSUPPORTED_TYPES[frontend_type],
            code="PRODUCTION_GEOMETRY_NOT_SUPPORTED",
        )
    engine_type = TYPE_MAP.get(frontend_type)
    if not engine_type:
        raise ProductionRequestError(
            f"Furniture type {frontend_type!r} is not supported by the production engine.",
            code="PRODUCTION_GEOMETRY_NOT_SUPPORTED",
        )

    width = _millimetres(config, "w", "width")
    height = _millimetres(config, "h", "height")
    depth = _millimetres(config, "d", "depth")
    sections = _bounded_int(
        config.get("sections", 1),
        field="sections",
        minimum=1,
        maximum=12,
    )
    drawers = _bounded_int(
        config.get("drawers", 0),
        field="drawers",
        minimum=0,
        maximum=6,
    )
    shelves = _bounded_int(
        config.get("shelves", 0),
        field="shelves",
        minimum=0,
        maximum=10,
    )
    door_type = str(config.get("doorType", "solid")).lower()
    if door_type not in DOOR_STYLE_MAP:
        raise ProductionRequestError(f"Unknown door type {door_type!r}.")

    material_key = str(config.get("mat", config.get("material", "oak"))).lower()
    material = MATERIAL_MAP.get(material_key)
    if not material:
        raise ProductionRequestError(f"Unknown production material {material_key!r}.")

    handle_key = str(config.get("handle", "none")).lower()
    handle = HANDLE_MAP.get(handle_key)
    if handle is None:
        raise ProductionRequestError(f"Unknown handle type {handle_key!r}.")

    zone_raw = str(payload.get("zone", config.get("zone", "dubai"))).strip().lower()
    zone = ZONE_MAP.get(zone_raw, "dubai")
    safe_name = re.sub(
        r"[^A-Za-z0-9 _.-]+",
        "",
        str(config.get("name", "FurniAI Furniture")),
    ).strip()[:80] or "FurniAI Furniture"

    spec: dict[str, Any] = {
        "name": safe_name,
        "unit_id": "FA1",
        "type": engine_type,
        "width": width,
        "height": height,
        "depth": depth,
        "material": material,
        "front_material": material,
        "handle": handle,
        "led": str(config.get("led", "off")).lower(),
        "zone": zone,
        "brief": (
            f"{safe_name}: {width} x {height} x {depth} mm, "
            f"{sections} sections, furniture joinery only."
        ),
        "source": {
            "contract": "furniai-configurator/1",
            "project_id": str(payload.get("project_id", ""))[:80],
            "revision_id": str(payload.get("revision_id", ""))[:80],
        },
    }

    if engine_type == "wardrobe":
        spec["bays"] = _wardrobe_bays(sections, drawers, shelves, door_type)
    elif engine_type == "shelving":
        spec["bays"] = _shelving_bays(sections, shelves)
        spec["base"] = {"type": "none", "height": 0, "setback": 0}
    elif engine_type == "console":
        spec["bays"] = _console_bays(
            sections, drawers, shelves, door_type
        )
        spec["base"] = {"type": "legs", "height": 100, "setback": 30}
    elif engine_type == "vanity":
        spec["bays"] = _vanity_bays(
            sections, drawers, shelves, door_type
        )
        spec["base"] = (
            {"type": "legs", "height": 100, "setback": 30}
            if frontend_type == "vanity_freestanding"
            else {"type": "none", "height": 0, "setback": 0}
        )

    return spec


def _zip_directory(outdir: Path, build_id: str, *, compact: bool = False) -> bytes:
    selected = None
    if compact:
        selected = {
            "report.json",
            "inspection.json",
            "inspection.txt",
            "cutlist.csv",
            "shop_drawings.pdf",
            "scene.json",
        }
    buffer = io.BytesIO()
    root_name = f"FurniAI-{build_id}"
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(outdir.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(outdir)
            if selected is not None and relative.as_posix() not in selected:
                continue
            archive.write(path, f"{root_name}/{relative.as_posix()}")
        archive.writestr(
            f"{root_name}/FACTORY_RELEASE_REQUIRED.txt",
            (
                "This pack passed software engineering checks only.\n"
                "It is NOT released for manufacturing.\n"
                "A qualified factory must validate the exact CNC post-processor, "
                "tooling, material behavior, calibration coupon, and first article.\n"
            ),
        )
    return buffer.getvalue()


def build_factory_review_pack(payload: dict[str, Any]) -> tuple[dict[str, Any], bytes]:
    spec = frontend_config_to_spec(payload)
    # The geometry builder annotates nested bay/module dictionaries while it
    # calculates positions. Keep preflight and pack generation isolated so a
    # validation pass cannot alter the frozen input used for production.
    preflight = inspector.inspect(copy.deepcopy(spec))
    if preflight.failures:
        error = ProductionRequestError(
            "The configuration did not pass deterministic engineering checks.",
            code="ENGINEERING_CHECKS_FAILED",
        )
        error.report = preflight.to_dict()
        raise error

    if os.environ.get("VERCEL") == "1":
        temp_root = "/tmp"
    else:
        temp_root = str(ROOT_DIR / "production-engine" / "output")
        os.makedirs(temp_root, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="furniai-", dir=temp_root) as temp_dir:
        outdir = Path(temp_dir) / "pack"
        report = furniai.run(copy.deepcopy(spec), str(outdir))
        packed = _zip_directory(outdir, report["build_id"])
        if len(packed) > MAX_RESPONSE_BYTES:
            packed = _zip_directory(outdir, report["build_id"], compact=True)
        if len(packed) > MAX_RESPONSE_BYTES:
            raise RuntimeError("Generated production pack exceeds the download limit.")
        return report, packed


class handler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header(
            "Access-Control-Expose-Headers",
            "Content-Disposition, X-FurniAI-Build-ID, X-FurniAI-Verdict, X-FurniAI-Release",
        )

    def _send_json(self, status: int, data: dict[str, Any]) -> None:
        body = json.dumps(data, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        self._send_json(
            200,
            {
                "ok": True,
                "service": "furniai-production-engine",
                "contract": "furniai-configurator/1",
                "supported_types": sorted(TYPE_MAP),
                "release_policy": "FACTORY_QUALIFICATION_REQUIRED",
            },
        )

    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self._send_json(
                413,
                {
                    "ok": False,
                    "code": "INVALID_REQUEST_SIZE",
                    "error": f"Request must be between 1 and {MAX_REQUEST_BYTES} bytes.",
                },
            )
            return

        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ProductionRequestError("Request body must be a JSON object.")
            report, packed = build_factory_review_pack(payload)
        except json.JSONDecodeError:
            self._send_json(
                400,
                {"ok": False, "code": "INVALID_JSON", "error": "Invalid JSON body."},
            )
            return
        except ProductionRequestError as exc:
            data: dict[str, Any] = {
                "ok": False,
                "code": exc.code,
                "error": str(exc),
            }
            if hasattr(exc, "report"):
                data["report"] = exc.report
            self._send_json(422, data)
            return
        except Exception:
            self._send_json(
                500,
                {
                    "ok": False,
                    "code": "PRODUCTION_ENGINE_ERROR",
                    "error": "The production engine could not generate this pack.",
                },
            )
            return

        build_id = report["build_id"]
        filename = f"FurniAI-{build_id}-factory-review.zip"
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(packed)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-FurniAI-Build-ID", build_id)
        self.send_header("X-FurniAI-Verdict", report["verdict"])
        self.send_header(
            "X-FurniAI-Release",
            report["manufacturing_release"]["status"],
        )
        self._cors()
        self.end_headers()
        self.wfile.write(packed)

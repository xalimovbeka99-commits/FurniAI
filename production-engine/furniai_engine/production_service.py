"""
FurniAI - Production Job HTTP Service API (Phase 1)
===================================================
Microservice wrapper for the FurniAI deterministic production engine.

Endpoints:
  GET  /health
  POST /v1/inspect
  POST /v1/production-jobs
  GET  /v1/production-jobs/{job_id}
  GET  /v1/production-jobs/{job_id}/artifacts/{filename}
"""
from __future__ import annotations
import json
import os
import sys
import hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

import standards as S
import buildid
import inspector
import furniai


JOBS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "jobs"))
os.makedirs(JOBS_DIR, exist_ok=True)


def get_job_id(job_envelope: dict) -> str:
    proj = job_envelope.get("project_id", "p1")
    rev = job_envelope.get("revision_id", "r1")
    std = buildid.STANDARDS_VERSION
    raw = f"{proj}:{rev}:{std}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12].upper()


class ProductionServiceHandler(BaseHTTPRequestHandler):

    def _send_json(self, status_code: int, data: dict):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, file_path: str, mime_type: str):
        if not os.path.exists(file_path):
            return self._send_json(404, {"error": "Artifact not found"})
        with open(file_path, "rb") as f:
            content = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(content)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/health":
            return self._send_json(200, {
                "status": "ok",
                "service": "furniai-production-engine",
                "standards_version": buildid.STANDARDS_VERSION
            })

        parts = path.split("/")[1:]  # e.g. ["v1", "production-jobs", "{job_id}", "artifacts", "{name}"]
        if len(parts) >= 3 and parts[0] == "v1" and parts[1] == "production-jobs":
            job_id = parts[2]
            job_dir = os.path.join(JOBS_DIR, job_id)
            report_file = os.path.join(job_dir, "report.json")

            if not os.path.exists(report_file):
                return self._send_json(404, {"error": f"Job {job_id} not found"})

            if len(parts) == 3:
                with open(report_file, "r", encoding="utf-8") as f:
                    report_data = json.load(f)
                return self._send_json(200, report_data)

            if len(parts) == 5 and parts[3] == "artifacts":
                filename = parts[4]
                file_path = os.path.join(job_dir, filename)
                mime = "application/octet-stream"
                if filename.endswith(".html"): mime = "text/html"
                elif filename.endswith(".json"): mime = "application/json"
                elif filename.endswith(".pdf"): mime = "application/pdf"
                elif filename.endswith(".csv"): mime = "text/csv"
                elif filename.endswith(".dxf"): mime = "application/dxf"
                return self._send_file(file_path, mime)

        return self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body_bytes.decode("utf-8"))
        except Exception as e:
            return self._send_json(400, {"error": f"Invalid JSON body: {e}"})

        if path == "/v1/inspect":
            spec = payload.get("spec", payload)
            try:
                rep = inspector.inspect(spec)
                return self._send_json(200, rep.to_dict())
            except Exception as e:
                return self._send_json(422, {"error": f"Inspection failed: {e}"})

        if path == "/v1/production-jobs":
            spec = payload.get("spec", payload)
            job_id = get_job_id(payload)
            job_dir = os.path.join(JOBS_DIR, job_id)
            try:
                report = furniai.run(spec, job_dir)
                report["job_id"] = job_id
                report["artifact_urls"] = {
                    "viewer": f"/v1/production-jobs/{job_id}/artifacts/viewer.html",
                    "pdf": f"/v1/production-jobs/{job_id}/artifacts/shop_drawings.pdf",
                    "cutlist": f"/v1/production-jobs/{job_id}/artifacts/cutlist.csv",
                    "scene": f"/v1/production-jobs/{job_id}/artifacts/scene.json",
                    "report": f"/v1/production-jobs/{job_id}/artifacts/report.json",
                }
                with open(os.path.join(job_dir, "report.json"), "w", encoding="utf-8") as f:
                    json.dump(report, f, indent=1)
                status_code = 200 if report.get("verdict") == "ENGINEERING CHECKS PASSED" else 422
                return self._send_json(status_code, report)
            except Exception as e:
                return self._send_json(500, {"error": f"Build generation failed: {e}"})

        return self._send_json(404, {"error": "Endpoint not found"})


def run_server(port=8000):
    server_address = ("", port)
    httpd = HTTPServer(server_address, ProductionServiceHandler)
    print(f"FurniAI Production Service listening on http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down service.")
        httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)

"""
FurniAI Unified Test Runner
===========================
Executes all 5 test harnesses and API integration tests:
  1. verify.py (40 standards checks & quote calibration)
  2. furniai.py (full pipeline across demo specs)
  3. inspector.py (9 gate checks across demo specs)
  4. audit_dxf.py (re-reads generated DXF files from disk)
  5. pack_check.py (cross-artefact build ID and bbox integrity)
  6. API integration tests (production_service endpoints)
"""
import subprocess
import sys
import os
import time
import json
import urllib.request

COMMANDS = [
    ["python", "verify.py"],
    ["python", "furniai.py", "wardrobe", "./out_wardrobe"],
    ["python", "furniai.py", "kitchen_base", "./out_kitchen"],
    ["python", "furniai.py", "vanity", "./out_vanity"],
    ["python", "inspector.py", "wardrobe"],
    ["python", "inspector.py", "kitchen_base"],
    ["python", "inspector.py", "vanity"],
    ["python", "audit_dxf.py", "./out_wardrobe"],
    ["python", "pack_check.py", "./out_wardrobe"],
]

def test_api_service():
    print("\n" + "="*74)
    print("  TESTING PRODUCTION SERVICE API ENDPOINTS (http://localhost:8901)")
    print("="*74)
    
    # Launch production_service on background port 8901
    proc = subprocess.Popen(["python", "production_service.py", "8901"],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(1.5)
    try:
        # 1. Health check
        req = urllib.request.urlopen("http://localhost:8901/health")
        health = json.loads(req.read().decode("utf-8"))
        assert health["status"] == "ok"
        print("  PASS  GET /health -> status: ok")

        # 2. Inspect endpoint
        inspect_payload = json.dumps({
            "spec": {
                "name": "API Test Wardrobe", "unit_id": "W_API",
                "type": "wardrobe", "width": 2400, "height": 2400, "depth": 600,
                "material": "walnut", "handle": "gold_bar", "zone": "dubai"
            }
        }).encode("utf-8")
        req = urllib.request.Request("http://localhost:8901/v1/inspect",
                                     data=inspect_payload,
                                     headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req)
        insp = json.loads(resp.read().decode("utf-8"))
        assert insp["verdict"] == "ENGINEERING CHECKS PASSED"
        print("  PASS  POST /v1/inspect -> verdict: ENGINEERING CHECKS PASSED")

        # 3. Production Jobs endpoint
        job_payload = json.dumps({
            "contract_version": "furnispec-job/1",
            "project_id": "proj-test-101",
            "revision_id": "rev-001",
            "spec": {
                "name": "API Test Kitchen", "unit_id": "K_API",
                "type": "kitchen_base", "width": 1800, "height": 720, "depth": 560,
                "material": "sage", "handle": "black_strip", "zone": "dubai"
            }
        }).encode("utf-8")
        req = urllib.request.Request("http://localhost:8901/v1/production-jobs",
                                     data=job_payload,
                                     headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req)
        job_res = json.loads(resp.read().decode("utf-8"))
        assert job_res["verdict"] == "ENGINEERING CHECKS PASSED"
        job_id = job_res["job_id"]
        print(f"  PASS  POST /v1/production-jobs -> job_id: {job_id}")

        # 4. Artifact download
        art_url = f"http://localhost:8901/v1/production-jobs/{job_id}/artifacts/cutlist.csv"
        art_req = urllib.request.urlopen(art_url)
        csv_text = art_req.read().decode("utf-8")
        assert "Length_Raw_Cut" in csv_text
        print("  PASS  GET /artifacts/cutlist.csv -> Contains Length_Raw_Cut")

    finally:
        proc.terminate()
        proc.wait()


def main():
    cwd = os.path.dirname(os.path.abspath(__file__))
    for cmd in COMMANDS:
        print(f"\n--- Running: {' '.join(cmd)} ---")
        res = subprocess.run(cmd, cwd=cwd)
        if res.returncode != 0:
            print(f"FAILED: {' '.join(cmd)}")
            sys.exit(1)
    
    test_api_service()
    
    print("\n" + "="*74)
    print("  ALL UNIFIED HARNESSES AND API TESTS PASSED SUCCESSFULLY!")
    print("="*74)

if __name__ == "__main__":
    main()

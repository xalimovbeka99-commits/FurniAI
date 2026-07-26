# FurniAI production engine

This directory contains the deterministic production-engine candidate imported
from `FurniAI_handover.zip`. It is intentionally separate from the deployed web
application until its contract, security boundary, and factory profile are
validated.

## Safety status

- Software geometry, machining, nesting, and pack-consistency checks can pass.
- Passing software checks does **not** authorize customer production.
- Manufacturing release remains blocked until a factory cuts the calibration
  coupon, builds the first article, records measurements, and approves the exact
  machine/post-processor profile and standards version.

## Local verification

Create an isolated Python environment and install `requirements.txt`, then run
these commands from `furniai_engine/`:

```text
python verify.py
python -m unittest test_safety_contract.py
python furniai.py wardrobe <output-directory>
python audit_dxf.py <output-directory>
python pack_check.py <output-directory>
python factory_test.py <factory-test-output-directory>
```

Generated outputs must stay outside the source tree or in an ignored temporary
directory.

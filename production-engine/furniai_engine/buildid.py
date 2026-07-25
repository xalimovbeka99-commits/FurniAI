"""
FurniAI - Build identity
========================
Every artefact in a pack is stamped with the same short ID, derived from the
input spec plus the standards version. If a viewer and a drawing set are ever
put side by side and the IDs differ, they are not the same furniture - and you
can see that in one second instead of arguing about it.
"""
import hashlib, json

STANDARDS_VERSION = "1.2.0"     # bump whenever standards.py changes a dimension


def build_id(spec: dict) -> str:
    payload = json.dumps({k: v for k, v in sorted(spec.items())
                          if not str(k).startswith("_")},
                         sort_keys=True, default=str)
    h = hashlib.sha256((payload + STANDARDS_VERSION).encode()).hexdigest()[:8].upper()
    return f"{h}"


def stamp(spec: dict) -> str:
    """The one-line identity that appears on every artefact."""
    return (f"{spec.get('name', spec.get('type','unit'))} | "
            f"{spec.get('width',0):.0f}x{spec.get('height',0):.0f}x"
            f"{spec.get('depth',0):.0f} | "
            f"{spec.get('material','-')} | "
            f"BUILD {build_id(spec)} | STD {STANDARDS_VERSION}")

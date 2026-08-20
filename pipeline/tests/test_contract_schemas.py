import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
VALID_BUNDLE = ROOT / "tests" / "fixtures" / "valid"


def test_contract_schemas_are_valid_draft_2020_12() -> None:
    for schema_path in sorted(CONTRACTS.glob("*.schema.json")):
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)


def test_valid_fixture_documents_match_their_schemas() -> None:
    document_schemas = {
        "source.json": "source.schema.json",
        "direction.json": "direction.schema.json",
        "assets.json": "assets.schema.json",
        "playback.json": "playback.schema.json",
    }
    for document_name, schema_name in document_schemas.items():
        document = json.loads((VALID_BUNDLE / document_name).read_text(encoding="utf-8"))
        schema = json.loads((CONTRACTS / schema_name).read_text(encoding="utf-8"))
        Draft202012Validator(schema).validate(document)

"""Shared primitives for reading and schema-checking Reader JSON documents."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

JsonObject = dict[str, Any]


@dataclass(frozen=True)
class ValidationIssue:
    """One actionable validation failure."""

    document: str
    path: str
    code: str
    message: str

    def __str__(self) -> str:
        return f"{self.document}:{self.path} [{self.code}] {self.message}"


def issue_key(issue: ValidationIssue) -> tuple[str, str, str, str]:
    """Stable sort key so validation output is deterministic."""

    return (issue.document, issue.path, issue.code, issue.message)


def load_json_object(
    path: Path,
    document: str,
    issues: list[ValidationIssue],
) -> JsonObject | None:
    """Read one JSON object, recording an issue instead of raising."""

    if not path.is_file():
        issues.append(
            ValidationIssue(document, "$", "file_not_found", f"file does not exist: {path}")
        )
        return None

    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        issues.append(ValidationIssue(document, "$", "invalid_json", str(error)))
        return None

    if not isinstance(value, dict):
        issues.append(
            ValidationIssue(
                document,
                "$",
                "invalid_document",
                "top-level JSON value must be an object",
            )
        )
        return None
    return value


def schema_issues(
    document: str,
    value: JsonObject,
    schema: JsonObject,
) -> list[ValidationIssue]:
    """Report every schema violation in a document, in stable order."""

    validator = Draft202012Validator(schema)
    return [
        ValidationIssue(
            document,
            _error_path(error),
            f"schema_{error.validator}",
            error.message,
        )
        for error in sorted(validator.iter_errors(value), key=_schema_error_key)
    ]


def json_path(parts: list[Any]) -> str:
    """Render a JSON Pointer path as the `$.a[0]["odd key"]` form used in output."""

    path = "$"
    for part in parts:
        if isinstance(part, int):
            path += f"[{part}]"
        elif isinstance(part, str) and part.replace("_", "").isalnum():
            path += f".{part}"
        else:
            path += f"[{json.dumps(part, ensure_ascii=False)}]"
    return path


def resolve_inside(
    root: Path,
    relative_path: str,
    document: str,
    path: str,
    issues: list[ValidationIssue],
    *,
    code: str,
    escape_message: str,
) -> Path | None:
    """Resolve a bundle-relative path, refusing anything that escapes `root`."""

    resolved_root = root.resolve()
    resolved_path = (resolved_root / relative_path).resolve()
    if not resolved_path.is_relative_to(resolved_root):
        issues.append(
            ValidationIssue(
                document,
                path,
                code,
                f"{escape_message}: {relative_path}",
            )
        )
        return None
    return resolved_path


def sha256_file(path: Path) -> str:
    """Hash a file without holding it in memory."""

    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        for chunk in iter(lambda: source_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _schema_error_key(error: ValidationError) -> tuple[str, str]:
    return (json_path(list(error.absolute_path)), error.message)


def _error_path(error: ValidationError) -> str:
    parts = list(error.absolute_path)
    if error.validator == "required":
        missing = _missing_required_property(error.message)
        if missing is not None:
            parts.append(missing)
    return json_path(parts)


def _missing_required_property(message: str) -> str | None:
    marker = "' is a required property"
    if marker not in message or not message.startswith("'"):
        return None
    return message[1 : message.index(marker)]

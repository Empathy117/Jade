"""Validation for the multi-book Reader library."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

from immersive_reader.validation import ValidationIssue, validate_bundle


def validate_library(
    library_path: Path,
    *,
    contracts_dir: Path | None = None,
) -> list[ValidationIssue]:
    """Validate the library manifest and every registered book bundle."""

    library_path = library_path.resolve()
    contracts_dir = (contracts_dir or Path.cwd() / "contracts").resolve()
    issues: list[ValidationIssue] = []
    library = _load_object(library_path, "library.json", issues)
    schema = _load_object(
        contracts_dir / "library.schema.json",
        "contracts/library.schema.json",
        issues,
    )
    if library is None or schema is None:
        return issues

    schema_issues = _schema_issues(library, schema)
    issues.extend(schema_issues)
    if schema_issues:
        return sorted(issues, key=_issue_key)

    library_root = library_path.parent
    seen_ids: set[str] = set()
    seen_paths: set[str] = set()
    for index, entry in enumerate(library["books"]):
        entry_path = f"$.books[{index}]"
        book_id = entry["book_id"]
        book_path = entry["path"]
        if book_id in seen_ids:
            issues.append(
                ValidationIssue(
                    "library.json",
                    f"{entry_path}.book_id",
                    "duplicate_book_id",
                    f"book id is already registered: {book_id}",
                )
            )
        seen_ids.add(book_id)
        if book_path in seen_paths:
            issues.append(
                ValidationIssue(
                    "library.json",
                    f"{entry_path}.path",
                    "duplicate_book_path",
                    f"book path is already registered: {book_path}",
                )
            )
        seen_paths.add(book_path)

        bundle_dir = _resolve_inside(
            library_root,
            book_path,
            f"{entry_path}.path",
            issues,
        )
        if bundle_dir is None:
            continue
        if not bundle_dir.is_dir():
            issues.append(
                ValidationIssue(
                    "library.json",
                    f"{entry_path}.path",
                    "book_directory_missing",
                    f"book directory does not exist: {bundle_dir}",
                )
            )
            continue

        cover_path = _resolve_inside(
            bundle_dir,
            entry["cover"],
            f"{entry_path}.cover",
            issues,
        )
        if cover_path is not None and not cover_path.is_file():
            issues.append(
                ValidationIssue(
                    "library.json",
                    f"{entry_path}.cover",
                    "cover_file_missing",
                    f"cover file does not exist: {cover_path}",
                )
            )

        source = _load_object(bundle_dir / "source.json", f"{book_path}/source.json", issues)
        if source is not None:
            _validate_entry_identity(entry, source, index, issues)

        for issue in validate_bundle(bundle_dir, contracts_dir=contracts_dir):
            issues.append(
                ValidationIssue(
                    f"{book_path}/{issue.document}",
                    issue.path,
                    issue.code,
                    issue.message,
                )
            )

    return sorted(issues, key=_issue_key)


def _validate_entry_identity(
    entry: dict[str, Any],
    source: dict[str, Any],
    index: int,
    issues: list[ValidationIssue],
) -> None:
    entry_path = f"$.books[{index}]"
    comparisons = (
        ("book_id", source.get("book_id"), entry["book_id"]),
        ("title", source.get("title"), entry["title"]),
        ("source_revision", source.get("revision"), entry["source_revision"]),
        (
            "paragraph_count",
            len(source.get("paragraphs", [])),
            entry["paragraph_count"],
        ),
    )
    for field, expected, actual in comparisons:
        if expected != actual:
            issues.append(
                ValidationIssue(
                    "library.json",
                    f"{entry_path}.{field}",
                    "library_source_mismatch",
                    f"expected {expected!r} from source.json, got {actual!r}",
                )
            )


def _load_object(
    path: Path,
    document: str,
    issues: list[ValidationIssue],
) -> dict[str, Any] | None:
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


def _schema_issues(
    document: dict[str, Any],
    schema: dict[str, Any],
) -> list[ValidationIssue]:
    validator = Draft202012Validator(schema)
    return [
        ValidationIssue(
            "library.json",
            _json_path(list(error.absolute_path)),
            f"schema_{error.validator}",
            error.message,
        )
        for error in sorted(validator.iter_errors(document), key=_schema_error_key)
    ]


def _schema_error_key(error: ValidationError) -> tuple[str, str]:
    return (_json_path(list(error.absolute_path)), error.message)


def _json_path(parts: list[Any]) -> str:
    path = "$"
    for part in parts:
        path += f"[{part}]" if isinstance(part, int) else f".{part}"
    return path


def _resolve_inside(
    root: Path,
    relative_path: str,
    issue_path: str,
    issues: list[ValidationIssue],
) -> Path | None:
    resolved_root = root.resolve()
    resolved_path = (resolved_root / relative_path).resolve()
    if not resolved_path.is_relative_to(resolved_root):
        issues.append(
            ValidationIssue(
                "library.json",
                issue_path,
                "path_outside_library",
                f"path escapes its allowed directory: {relative_path}",
            )
        )
        return None
    return resolved_path


def _issue_key(issue: ValidationIssue) -> tuple[str, str, str, str]:
    return (issue.document, issue.path, issue.code, issue.message)

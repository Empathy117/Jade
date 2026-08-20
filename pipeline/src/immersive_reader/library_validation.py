"""Validation for the multi-book Reader library."""

from __future__ import annotations

from pathlib import Path

from immersive_reader.documents import (
    JsonObject,
    ValidationIssue,
    issue_key,
    load_json_object,
    resolve_inside,
    schema_issues,
)
from immersive_reader.validation import validate_bundle


def validate_library(
    library_path: Path,
    *,
    contracts_dir: Path | None = None,
) -> list[ValidationIssue]:
    """Validate the library manifest and every registered book bundle."""

    library_path = library_path.resolve()
    contracts_dir = (contracts_dir or Path.cwd() / "contracts").resolve()
    issues: list[ValidationIssue] = []
    library = load_json_object(library_path, "library.json", issues)
    schema = load_json_object(
        contracts_dir / "library.schema.json",
        "contracts/library.schema.json",
        issues,
    )
    if library is None or schema is None:
        return issues

    library_schema_issues = schema_issues("library.json", library, schema)
    issues.extend(library_schema_issues)
    if library_schema_issues:
        return sorted(issues, key=issue_key)

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

        bundle_dir = _resolve_in_library(
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

        cover_path = _resolve_in_library(
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

        source = load_json_object(
            bundle_dir / "source.json", f"{book_path}/source.json", issues
        )
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

    return sorted(issues, key=issue_key)


def _validate_entry_identity(
    entry: JsonObject,
    source: JsonObject,
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


def _resolve_in_library(
    root: Path,
    relative_path: str,
    issue_path: str,
    issues: list[ValidationIssue],
) -> Path | None:
    return resolve_inside(
        root,
        relative_path,
        "library.json",
        issue_path,
        issues,
        code="path_outside_library",
        escape_message="path escapes its allowed directory",
    )

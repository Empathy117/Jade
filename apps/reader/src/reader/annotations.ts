/**
 * Reader-written margin notes, one per paragraph, in the reader's own words.
 *
 * The immutable source stays untouched: annotations live beside the book in
 * local storage, keyed by paragraph id, and never outlive the revision whose
 * paragraph ids they reference.
 */

export interface Annotation {
  id: string;
  text: string;
  updatedAt: number;
}

export function annotationsStorageKey(bookId: string, sourceRevision: number): string {
  return `immersive-reader:${bookId}:annotations:revision-${sourceRevision}`;
}

/** Parse saved annotations, discarding anything that is not the expected shape. */
export function parseAnnotations(saved: string | null): Annotation[] {
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is Annotation =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Annotation).id === "string" &&
        typeof (entry as Annotation).text === "string" &&
        typeof (entry as Annotation).updatedAt === "number",
    );
  } catch {
    return [];
  }
}

export function annotationFor(
  annotations: Annotation[],
  paragraphId: string,
): Annotation | null {
  return annotations.find((annotation) => annotation.id === paragraphId) ?? null;
}

/**
 * Write the paragraph's annotation; empty text removes it.
 *
 * Order is kept stable so the annotations list does not reshuffle on edit.
 */
export function upsertAnnotation(
  annotations: Annotation[],
  paragraphId: string,
  text: string,
  updatedAt: number,
): Annotation[] {
  const trimmed = text.trim();
  const without = annotations.filter((annotation) => annotation.id !== paragraphId);
  if (!trimmed) return without;
  const existing = annotationFor(annotations, paragraphId);
  if (!existing) return [...annotations, { id: paragraphId, text: trimmed, updatedAt }];
  return annotations.map((annotation) =>
    annotation.id === paragraphId ? { ...annotation, text: trimmed, updatedAt } : annotation,
  );
}

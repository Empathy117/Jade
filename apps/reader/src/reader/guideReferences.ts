import { sourceIllustrationUrl } from "./data";
import type {
  GuideDocument,
  GuideReference,
  SourceDocument,
  SourceIllustration,
} from "./types";

export interface ResolvedReference {
  reference: GuideReference;
  illustration: SourceIllustration;
  src: string;
}

export function resolveGuideReferences(
  source: SourceDocument,
  guide: GuideDocument | null,
  bookPath: string,
): ResolvedReference[] {
  const illustrations = new Map(
    (source.illustrations ?? []).map((illustration) => [illustration.id, illustration]),
  );
  return (guide?.references ?? []).flatMap((reference) => {
    const illustration = illustrations.get(reference.illustration_id);
    return illustration
      ? [{
          reference,
          illustration,
          src: sourceIllustrationUrl(bookPath, illustration),
        }]
      : [];
  });
}

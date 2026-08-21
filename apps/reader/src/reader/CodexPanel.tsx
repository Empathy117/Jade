import { useMemo, useState } from "react";

import { BookMap } from "./BookMap";
import { locateOnMaps } from "./codex";
import type {
  CharacterView,
  CodexView,
  MapView,
  PlaceView,
} from "./codex";
import { bookFileUrl } from "./data";
import { FamilyTree } from "./FamilyTree";
import type { ResolvedReference } from "./guideReferences";
import type { ParagraphPositions } from "./readerState";
import { ReferenceGalleryContent } from "./ReferenceGallery";

export type CodexTab = "people" | "atlas" | "gallery";

interface CodexPanelProps {
  view: CodexView;
  references: ResolvedReference[];
  bookPath: string;
  /** The current scene's location tag, for the you-are-here marker. */
  activeLocation: string | null;
  /** Furthest-read position at the previous dossier visit; later anchors are new. */
  seenIndex: number;
  positions: ParagraphPositions;
  initialTab: CodexTab | null;
  initialReferenceId: string | null;
  onJump: (paragraphId: string) => void;
  onClose: () => void;
}

export function CodexPanel({
  view,
  references,
  bookPath,
  activeLocation,
  seenIndex,
  positions,
  initialTab,
  initialReferenceId,
  onJump,
  onClose,
}: CodexPanelProps) {
  const tabs = useMemo(() => {
    const available: Array<{ id: CodexTab; label: string }> = [];
    if (view.hasPeople) available.push({ id: "people", label: "人物" });
    if (view.hasAtlas) available.push({ id: "atlas", label: "地图" });
    if (references.length > 0) available.push({ id: "gallery", label: "图册" });
    return available;
  }, [references.length, view.hasAtlas, view.hasPeople]);

  const [tab, setTab] = useState<CodexTab | null>(() => {
    if (initialTab && tabs.some((entry) => entry.id === initialTab)) return initialTab;
    return tabs[0]?.id ?? null;
  });
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(
    initialReferenceId,
  );

  const isFresh = (at: string): boolean =>
    (positions.get(at) ?? Number.NEGATIVE_INFINITY) > seenIndex;

  if (tab === null) return null;

  return (
    <div
      className="reference-backdrop"
      data-interactive="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="codex-panel" role="dialog" aria-modal="true" aria-label="档案">
        <header className="codex-heading">
          <div>
            <p>档案</p>
            <span>随阅读进度解锁 · 正文没说的，这里不说</span>
          </div>
          <button type="button" aria-label="关闭档案" onClick={onClose}>
            ×
          </button>
        </header>

        {tabs.length > 1 ? (
          <nav className="codex-tabs" role="tablist" aria-label="档案页签">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={entry.id === tab}
                className={entry.id === tab ? "is-current" : ""}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
            <span className="codex-tabs__meta">{tabMeta(tab, view, references.length)}</span>
          </nav>
        ) : null}

        <div className="codex-body">
          {tab === "people" ? (
            <PeopleTab view={view} bookPath={bookPath} isFresh={isFresh} onJump={onJump} />
          ) : null}
          {tab === "atlas" ? (
            <AtlasTab
              view={view}
              bookPath={bookPath}
              activeLocation={activeLocation}
              references={references}
              isFresh={isFresh}
              onJump={onJump}
              onShowSource={(referenceId) => {
                setSelectedReferenceId(referenceId);
                setTab("gallery");
              }}
            />
          ) : null}
          {tab === "gallery" ? (
            <ReferenceGalleryContent
              items={references}
              selectedId={selectedReferenceId}
              onSelect={setSelectedReferenceId}
              onJump={onJump}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function tabMeta(tab: CodexTab, view: CodexView, referenceCount: number): string {
  if (tab === "people") return `已入册 ${view.charactersById.size} 人`;
  if (tab === "atlas") {
    return view.maps.length > 0
      ? `已解锁 ${view.maps.length} 张地图 · ${view.places.length} 处地点`
      : `已解锁 ${view.places.length} 处地点`;
  }
  return `原书附图 · 已解锁 ${referenceCount} 张`;
}

/* ————— 人物 ————— */

interface PeopleTabProps {
  view: CodexView;
  bookPath: string;
  isFresh: (at: string) => boolean;
  onJump: (paragraphId: string) => void;
}

function PeopleTab({ view, bookPath, isFresh, onJump }: PeopleTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      view.trees[0]?.nodes[0]?.node.character_id ??
      view.roster[0]?.members[0]?.character.id ??
      null,
  );
  const selected = selectedId ? view.charactersById.get(selectedId) ?? null : null;

  return (
    <div className="codex-people">
      <div className="codex-people__main">
        {view.trees.map((tree) => (
          <section key={tree.tree.id} className="codex-tree">
            <h3>{tree.tree.title}</h3>
            <FamilyTree tree={tree} selectedId={selectedId} onSelect={setSelectedId} />
          </section>
        ))}
        {view.roster.map((group) => (
          <section key={group.group} className="codex-roster">
            <h3>{group.group}</h3>
            <div className="codex-chips">
              {group.members.map((member) => (
                <button
                  key={member.character.id}
                  type="button"
                  className={`codex-chip${member.character.id === selectedId ? " is-current" : ""}`}
                  onClick={() => setSelectedId(member.character.id)}
                >
                  {isFresh(member.character.at) ? (
                    <span className="codex-chip__new" title="新入册" />
                  ) : null}
                  {member.character.name}
                  {member.currentStatus && member.currentStatus.kind !== "alive" ? (
                    <span
                      className={`codex-chip__status codex-chip__status--${member.currentStatus.kind}`}
                      title={member.currentStatus.label}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <aside className="codex-card" aria-live="polite">
        {selected ? (
          <CharacterCard
            view={selected}
            allCharacters={view.charactersById}
            bookPath={bookPath}
            isFresh={isFresh}
            onSelect={setSelectedId}
            onJump={onJump}
          />
        ) : (
          <p className="codex-empty">点选谱系或名录中的人物。</p>
        )}
      </aside>
    </div>
  );
}

interface CharacterCardProps {
  view: CharacterView;
  allCharacters: Map<string, CharacterView>;
  bookPath: string;
  isFresh: (at: string) => boolean;
  onSelect: (characterId: string) => void;
  onJump: (paragraphId: string) => void;
}

function CharacterCard({
  view,
  allCharacters,
  bookPath,
  isFresh,
  onSelect,
  onJump,
}: CharacterCardProps) {
  const { character } = view;
  return (
    <>
      <div className="codex-card__who">
        {character.portrait ? (
          <img
            className="codex-card__portrait"
            src={bookFileUrl(bookPath, character.portrait)}
            alt=""
          />
        ) : (
          <span className="codex-card__monogram" aria-hidden="true">
            {character.name.charAt(0)}
          </span>
        )}
        <div>
          <h2>{character.name}</h2>
          {view.aliases.length > 0 ? (
            <p className="codex-card__alias">
              又名 {view.aliases.map((alias) => `「${alias.name}」`).join("、")}
            </p>
          ) : null}
        </div>
      </div>

      {view.appeared ? (
        character.role ? (
          <p className="codex-card__role">{character.role}</p>
        ) : null
      ) : (
        <p className="codex-card__role codex-card__role--pending">
          尚未登场——名字见于已解锁的谱系。
        </p>
      )}

      {view.status.length > 0 ? (
        <>
          <h4>状态时间线</h4>
          <ul className="codex-timeline">
            {view.status.map((status) => (
              <li key={status.at} className={isFresh(status.at) ? "is-fresh" : ""}>
                <span className={`codex-bead codex-bead--${status.kind}`} aria-hidden="true" />
                <span className="codex-timeline__label">{status.label}</span>
                <button type="button" className="codex-jump" onClick={() => onJump(status.at)}>
                  回到原文 <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {view.facts.length > 0 ? (
        <>
          <h4>已知事实</h4>
          <ul className="codex-facts">
            {view.facts.map((fact) => (
              <li key={fact.at} className={isFresh(fact.at) ? "is-fresh" : ""}>
                {fact.text}
                <button type="button" className="codex-jump" onClick={() => onJump(fact.at)}>
                  回到原文 <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {view.relations.length > 0 ? (
        <>
          <h4>关系</h4>
          <div className="codex-rels">
            {view.relations.map((relation) => {
              const other = allCharacters.get(relation.otherId);
              if (!other) return null;
              return (
                <button
                  key={`${relation.otherId}-${relation.label}`}
                  type="button"
                  onClick={() => onSelect(relation.otherId)}
                >
                  {other.character.name}
                  <small>{relation.label}</small>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {view.appeared ? (
        <footer className="codex-card__foot">
          <button type="button" className="codex-jump" onClick={() => onJump(character.at)}>
            首次登场 <span aria-hidden="true">→</span>
          </button>
        </footer>
      ) : null}
    </>
  );
}

/* ————— 地图 ————— */

interface AtlasTabProps {
  view: CodexView;
  bookPath: string;
  activeLocation: string | null;
  references: ResolvedReference[];
  isFresh: (at: string) => boolean;
  onJump: (paragraphId: string) => void;
  onShowSource: (referenceId: string) => void;
}

function AtlasTab({
  view,
  bookPath,
  activeLocation,
  references,
  isFresh,
  onJump,
  onShowSource,
}: AtlasTabProps) {
  const here = locateOnMaps(view, activeLocation);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(
    () => here?.mapId ?? view.maps[0]?.map.id ?? null,
  );
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    () => here?.placeId ?? null,
  );
  const selectedMap: MapView | null =
    view.maps.find((map) => map.map.id === selectedMapId) ?? view.maps[0] ?? null;
  const selectedPlace = selectedPlaceId
    ? view.placesById.get(selectedPlaceId) ?? null
    : null;
  const sourceReference = selectedMap?.map.source_illustration_id
    ? references.find(
        (reference) =>
          reference.illustration.id === selectedMap.map.source_illustration_id,
      )
    : undefined;

  return (
    <div className="codex-atlas">
      <div className="codex-atlas__main">
        {view.maps.length > 1 ? (
          <div className="codex-chips codex-atlas__switch" role="group" aria-label="选择地图">
            {view.maps.map((map) => (
              <button
                key={map.map.id}
                type="button"
                className={`codex-chip${map.map.id === selectedMap?.map.id ? " is-current" : ""}`}
                onClick={() => setSelectedMapId(map.map.id)}
              >
                {isFresh(map.map.at) ? <span className="codex-chip__new" title="新解锁" /> : null}
                {map.map.title}
              </button>
            ))}
          </div>
        ) : null}

        {selectedMap ? (
          <>
            <BookMap
              key={selectedMap.map.id}
              map={selectedMap}
              src={bookFileUrl(bookPath, selectedMap.map.image)}
              selectedPlaceId={selectedPlaceId}
              activePlaceId={here?.mapId === selectedMap.map.id ? here.placeId : null}
              onSelectPlace={setSelectedPlaceId}
            />
            <div className="codex-atlas__legend">
              <span>
                <span className="codex-atlas__swatch codex-atlas__swatch--here" />
                你在这里
              </span>
              <span>
                <span className="codex-atlas__swatch" />
                可点选地点
              </span>
              <span>拖动平移 · 双指或滚轮缩放</span>
              {sourceReference ? (
                <button
                  type="button"
                  className="codex-jump"
                  onClick={() => onShowSource(sourceReference.reference.id)}
                >
                  查看原书扫描 <span aria-hidden="true">→</span>
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {view.unmappedPlaces.length > 0 ? (
          <section className="codex-roster">
            <h3>{view.maps.length > 0 ? "尚未入图的地点" : "已到过的地点"}</h3>
            <div className="codex-chips">
              {view.unmappedPlaces.map((place) => (
                <button
                  key={place.place.id}
                  type="button"
                  className={`codex-chip${place.place.id === selectedPlaceId ? " is-current" : ""}`}
                  onClick={() => setSelectedPlaceId(place.place.id)}
                >
                  {isFresh(place.place.at) ? (
                    <span className="codex-chip__new" title="新解锁" />
                  ) : null}
                  {place.place.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="codex-card" aria-live="polite">
        {selectedPlace ? (
          <PlaceCard view={view} place={selectedPlace} isFresh={isFresh} onJump={onJump} />
        ) : (
          <p className="codex-empty">点选地图标记或地点名。</p>
        )}
      </aside>
    </div>
  );
}

interface PlaceCardProps {
  view: CodexView;
  place: PlaceView;
  isFresh: (at: string) => boolean;
  onJump: (paragraphId: string) => void;
}

function PlaceCard({ view, place, isFresh, onJump }: PlaceCardProps) {
  const chain: string[] = [];
  let parentId = place.place.parent;
  while (parentId) {
    const parent = view.placesById.get(parentId);
    if (!parent) break;
    chain.unshift(parent.place.name);
    parentId = parent.place.parent;
  }

  return (
    <>
      <div className="codex-card__who">
        <span className="codex-card__monogram" aria-hidden="true">
          {place.place.name.charAt(0)}
        </span>
        <div>
          <h2>{place.place.name}</h2>
          {chain.length > 0 ? (
            <p className="codex-card__alias">{chain.join(" › ")}</p>
          ) : null}
        </div>
      </div>

      {place.facts.length > 0 ? (
        <>
          <h4>已知信息</h4>
          <ul className="codex-facts">
            {place.facts.map((fact) => (
              <li key={fact.at} className={isFresh(fact.at) ? "is-fresh" : ""}>
                {fact.text}
                <button type="button" className="codex-jump" onClick={() => onJump(fact.at)}>
                  回到原文 <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {place.scenes.length > 0 ? (
        <>
          <h4>已读场景</h4>
          <ul className="codex-scenes">
            {place.scenes.map((scene) => (
              <li key={scene.sceneId}>
                <span>{scene.label}</span>
                <button type="button" className="codex-jump" onClick={() => onJump(scene.startId)}>
                  回到原文 <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

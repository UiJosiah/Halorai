import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { BlendMode } from "@/lib/api";
import { del, getBlob, getFile, putBlob, putFile } from "@/lib/idbFileStore";

export type EventDetails = {
  churchName: string;
  date: string;
  time: string;
  eventName: string;
  venue: string;
  theme: string;
  otherInfo: string;
};

export type FlyerConcept = {
  id: number;
  label: string;
  description: string;
};

/** Reserved id for user-written background concept (not from AI list). */
export const CUSTOM_CONCEPT_ID = 4;

/** Step 3 base palette: `null` not chosen yet; `"skip"` = AI chooses freely; otherwise image path under `/Halorai Dev/Base-colours/`. */
export type BaseColourChoice = null | "skip" | string;

export type LocalFileItem = {
  id: string;
  file: File;
  previewUrl: string;
};

export type MinisterLocalRow = {
  id: string;
  avatar: LocalFileItem;
  name: string;
  title: string;
  placeholderName: string;
  placeholderTitle: string;
};

export type FlyerImage = {
  mimeType: string;
  base64: string;
};

/** Step 3ii: stack of AI backgrounds (display + cache key + optional raw AI for colour re-blend). Survives Step 3 ↔ 3ii navigation. */
export type BackgroundHistoryEntry = { image: FlyerImage; key: string; rawAi?: FlyerImage };

export type BackgroundHistState = { entries: BackgroundHistoryEntry[]; index: number };

const EMPTY_BACKGROUND_HIST: BackgroundHistState = { entries: [], index: -1 };

type CreateDesignState = {
  eventDetails: EventDetails;
  setEventDetails: React.Dispatch<React.SetStateAction<EventDetails>>;

  assetsHydrated: boolean;

  logos: LocalFileItem[];
  setLogos: React.Dispatch<React.SetStateAction<LocalFileItem[]>>;

  ministers: MinisterLocalRow[];
  setMinisters: React.Dispatch<React.SetStateAction<MinisterLocalRow[]>>;

  conceptsKey: string;
  setConceptsKey: (next: string) => void;

  concepts: FlyerConcept[];
  setConcepts: (next: FlyerConcept[]) => void;

  selectedConceptId: number | null;
  setSelectedConceptId: (next: number | null) => void;

  /** Text for the "Custom" option; used when selectedConceptId === CUSTOM_CONCEPT_ID */
  customConceptText: string;
  setCustomConceptText: (next: string) => void;

  /** Resolved description for Step 4 / Step 5 (AI concept or custom text). */
  selectedConceptDescription: string;

  flyerKey: string;
  setFlyerKey: (next: string) => void;

  flyerImage: FlyerImage | null;
  setFlyerImage: (next: FlyerImage | null) => void;

  /** Step 3ii: AI-generated background preview (4:5 portrait), not the final flyer. */
  backgroundPreviewImage: FlyerImage | null;
  setBackgroundPreviewImage: (next: FlyerImage | null) => void;
  backgroundPreviewKey: string;
  setBackgroundPreviewKey: (next: string) => void;
  /** Step 3ii: multi-version history + raw AI for base-colour blend without regeneration. */
  backgroundHistory: BackgroundHistState;
  setBackgroundHistory: React.Dispatch<React.SetStateAction<BackgroundHistState>>;
  /** Step 3ii: base-colour blend controls (context so Step 3 ↔ 3ii does not reset sliders). */
  backgroundBlendMode: BlendMode;
  setBackgroundBlendMode: React.Dispatch<React.SetStateAction<BlendMode>>;
  backgroundBlendOpacity: number;
  setBackgroundBlendOpacity: React.Dispatch<React.SetStateAction<number>>;
  /** Optional notes from Step 3ii textarea when continuing (refinements). */
  backgroundRefinementNotes: string;
  setBackgroundRefinementNotes: (next: string) => void;

  baseColourChoice: BaseColourChoice;
  setBaseColourChoice: React.Dispatch<React.SetStateAction<BaseColourChoice>>;
};

const defaultEventDetails: EventDetails = {
  churchName: "",
  date: "",
  time: "",
  eventName: "",
  venue: "",
  theme: "",
  otherInfo: "",
};

const Ctx = createContext<CreateDesignState | null>(null);

const LS_EVENT_DETAILS = "createDesign_eventDetails";
const LS_CONCEPTS = "createDesign_concepts";
const LS_CONCEPTS_KEY = "createDesign_conceptsKey";
const LS_SELECTED_CONCEPT_ID = "createDesign_selectedConceptId";
const LS_CUSTOM_CONCEPT_TEXT = "createDesign_customConceptText";
const LS_FLYER_KEY = "createDesign_flyerKey";
const LS_LOGOS = "createDesign_logos_v1";
const LS_MINISTERS = "createDesign_ministers_v1";
const LS_FLYER_IMAGE_META = "createDesign_flyerImageMeta_v1";
const LS_BACKGROUND_PREVIEW_META = "createDesign_backgroundPreviewMeta_v1";
const LS_BACKGROUND_PREVIEW_KEY = "createDesign_backgroundPreviewKey_v1";
const LS_BACKGROUND_REFINEMENT = "createDesign_backgroundRefinement_v1";
const LS_BASE_COLOUR_CHOICE = "createDesign_baseColourChoice_v1";

const IDB_FLYER_IMAGE = "flyerImage_v1";
const IDB_BACKGROUND_PREVIEW = "backgroundPreview_v1";

/** Must match Step 3ii MAX_BG_GENERATIONS */
const BG_HIST_STORAGE_SLOTS = 3;

const LS_BACKGROUND_HISTORY_META = "createDesign_backgroundHistoryMeta_v1";

function idbBackgroundHistDisplay(slot: number): string {
  return `backgroundHist_v1_disp_${slot}`;
}
function idbBackgroundHistRaw(slot: number): string {
  return `backgroundHist_v1_raw_${slot}`;
}

type StoredBackgroundHistMeta = {
  baseKey: string;
  index: number;
  entries: { key: string; displayMime: string; rawMime?: string | null }[];
  blendMode?: BlendMode;
  blendOpacity?: number;
};

const BLEND_MODES: readonly BlendMode[] = [
  "overlay",
  "soft_light",
  "multiply",
  "screen",
  "difference",
  "luminosity",
];

function isBlendMode(v: unknown): v is BlendMode {
  return typeof v === "string" && (BLEND_MODES as readonly string[]).includes(v);
}

function conceptDescriptionFromState(
  selectedConceptId: number | null,
  customConceptText: string,
  concepts: FlyerConcept[]
): string {
  if (selectedConceptId === CUSTOM_CONCEPT_ID) return customConceptText.trim();
  const c = concepts.find((x) => x.id === selectedConceptId);
  return (c?.description || concepts[0]?.description || "").trim();
}

type StoredFileRef = { id: string; name: string; type: string; lastModified: number };
type StoredMinisterRow = {
  id: string;
  avatar: StoredFileRef;
  name: string;
  title: string;
  placeholderName: string;
  placeholderTitle: string;
};

function _safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseBaseColourChoice(raw: string | null): BaseColourChoice {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v === "skip") return "skip";
    if (typeof v === "string" && v.startsWith("/Halorai Dev/Base-colours/")) return v;
  } catch {
    return null;
  }
  return null;
}

export function CreateDesignProvider({ children }: { children: React.ReactNode }) {
  const [eventDetails, setEventDetails] = useState<EventDetails>(() => {
    const stored = _safeJsonParse<Partial<EventDetails>>(localStorage.getItem(LS_EVENT_DETAILS));
    return { ...defaultEventDetails, ...(stored ?? {}) };
  });
  const [assetsHydrated, setAssetsHydrated] = useState(false);
  const [logos, setLogos] = useState<LocalFileItem[]>([]);
  const [ministers, setMinisters] = useState<MinisterLocalRow[]>([]);
  const [conceptsKey, setConceptsKey] = useState<string>(() => localStorage.getItem(LS_CONCEPTS_KEY) || "");
  const [concepts, setConcepts] = useState<FlyerConcept[]>(() => _safeJsonParse<FlyerConcept[]>(localStorage.getItem(LS_CONCEPTS)) ?? []);
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(() => {
    const raw = localStorage.getItem(LS_SELECTED_CONCEPT_ID);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  });
  const [customConceptText, setCustomConceptText] = useState<string>(() => localStorage.getItem(LS_CUSTOM_CONCEPT_TEXT) || "");
  const [flyerKey, setFlyerKey] = useState<string>(() => localStorage.getItem(LS_FLYER_KEY) || "");
  const [flyerImage, setFlyerImage] = useState<FlyerImage | null>(null);
  const [backgroundPreviewImage, setBackgroundPreviewImage] = useState<FlyerImage | null>(null);
  const [backgroundPreviewKey, setBackgroundPreviewKey] = useState<string>(() => localStorage.getItem(LS_BACKGROUND_PREVIEW_KEY) || "");
  const [backgroundHistory, setBackgroundHistory] = useState<BackgroundHistState>(() => ({ ...EMPTY_BACKGROUND_HIST }));
  const [backgroundBlendMode, setBackgroundBlendMode] = useState<BlendMode>("soft_light");
  const [backgroundBlendOpacity, setBackgroundBlendOpacity] = useState(0.45);
  const [backgroundRefinementNotes, setBackgroundRefinementNotes] = useState<string>(
    () => localStorage.getItem(LS_BACKGROUND_REFINEMENT) || ""
  );
  const [baseColourChoice, setBaseColourChoice] = useState<BaseColourChoice>(() =>
    parseBaseColourChoice(localStorage.getItem(LS_BASE_COLOUR_CHOICE))
  );

  const prevLogoIdsRef = useRef<Set<string>>(new Set());
  const prevMinisterAvatarIdsRef = useRef<Set<string>>(new Set());
  /** After first sync, any Step 1 theme edit clears Step 3+ downstream so the flow matches a fresh session. */
  const prevThemeForConceptsRef = useRef<string | null>(null);

  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(r.error || new Error("Failed to read blob"));
      r.readAsDataURL(blob);
    });
    const comma = dataUrl.indexOf(",");
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  };

  const selectedConceptDescription = useMemo(() => {
    if (selectedConceptId === CUSTOM_CONCEPT_ID) return customConceptText.trim();
    const c = concepts.find((x) => x.id === selectedConceptId);
    return (c?.description || concepts[0]?.description || "").trim();
  }, [concepts, customConceptText, selectedConceptId]);

  const backgroundBaseCacheKey = useMemo(
    () =>
      JSON.stringify({
        c: selectedConceptDescription,
        t: (eventDetails.theme || "").trim(),
        r: "",
        x: "",
      }),
    [eventDetails.theme, selectedConceptDescription]
  );

  // Hydrate Step 2 assets + Step 5 flyer image from storage (refresh-safe).
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const storedLogos = _safeJsonParse<StoredFileRef[]>(localStorage.getItem(LS_LOGOS)) ?? [];
        const storedMinisters = _safeJsonParse<StoredMinisterRow[]>(localStorage.getItem(LS_MINISTERS)) ?? [];
        const flyerMeta = _safeJsonParse<{ mimeType: string }>(localStorage.getItem(LS_FLYER_IMAGE_META));
        const bgMeta = _safeJsonParse<{ mimeType: string }>(localStorage.getItem(LS_BACKGROUND_PREVIEW_META));

        const conceptTrim = conceptDescriptionFromState(selectedConceptId, customConceptText, concepts);
        const themeTrim = (eventDetails.theme || "").trim();
        const baseKey = JSON.stringify({ c: conceptTrim, t: themeTrim, r: "", x: "" });

        const hydratedLogos: LocalFileItem[] = [];
        for (const ref of storedLogos) {
          const f = await getFile(ref.id);
          if (!f) continue;
          hydratedLogos.push({ id: ref.id, file: f, previewUrl: URL.createObjectURL(f) });
        }

        const hydratedMinisters: MinisterLocalRow[] = [];
        for (const row of storedMinisters) {
          const f = await getFile(row.avatar.id);
          if (!f) continue;
          hydratedMinisters.push({
            id: row.id,
            avatar: { id: row.avatar.id, file: f, previewUrl: URL.createObjectURL(f) },
            name: row.name,
            title: row.title,
            placeholderName: row.placeholderName,
            placeholderTitle: row.placeholderTitle,
          });
        }

        let hydratedFlyer: FlyerImage | null = null;
        if (flyerMeta?.mimeType) {
          const blob = await getBlob(IDB_FLYER_IMAGE);
          if (blob) {
            const b64 = await blobToBase64(blob);
            hydratedFlyer = { mimeType: flyerMeta.mimeType || blob.type || "image/png", base64: b64 };
          }
        }

        const histMeta = _safeJsonParse<StoredBackgroundHistMeta>(localStorage.getItem(LS_BACKGROUND_HISTORY_META));
        let hydratedHist: BackgroundHistState | null = null;

        if (
          histMeta &&
          typeof histMeta.index === "number" &&
          Array.isArray(histMeta.entries) &&
          histMeta.entries.length > 0 &&
          histMeta.baseKey === baseKey
        ) {
          const built: BackgroundHistoryEntry[] = [];
          let complete = true;
          for (let i = 0; i < histMeta.entries.length; i++) {
            const spec = histMeta.entries[i];
            const dispBlob = await getBlob(idbBackgroundHistDisplay(i));
            if (!dispBlob) {
              complete = false;
              break;
            }
            const dMime = spec.displayMime || dispBlob.type || "image/png";
            const dB64 = await blobToBase64(dispBlob);
            const image: FlyerImage = { mimeType: dMime, base64: dB64 };
            let rawAi: FlyerImage | undefined;
            const rawBlob = await getBlob(idbBackgroundHistRaw(i));
            if (rawBlob) {
              const rMime = spec.rawMime || rawBlob.type || "image/png";
              const rB64 = await blobToBase64(rawBlob);
              rawAi = { mimeType: rMime, base64: rB64 };
            }
            built.push({ image, key: spec.key, ...(rawAi ? { rawAi } : {}) });
          }
          if (complete && built.length === histMeta.entries.length) {
            const idx = Math.min(Math.max(0, histMeta.index), built.length - 1);
            hydratedHist = { entries: built, index: idx };
          }
        }

        let hydratedBg: FlyerImage | null = null;
        if (hydratedHist && hydratedHist.entries.length > 0) {
          const cur = hydratedHist.entries[hydratedHist.index];
          if (cur?.image) hydratedBg = cur.image;
        } else if (bgMeta?.mimeType) {
          const blob = await getBlob(IDB_BACKGROUND_PREVIEW);
          if (blob) {
            const b64 = await blobToBase64(blob);
            hydratedBg = { mimeType: bgMeta.mimeType || blob.type || "image/png", base64: b64 };
          }
        }

        if (cancelled) return;
        setLogos(hydratedLogos);
        setMinisters(hydratedMinisters);
        setFlyerImage(hydratedFlyer);
        if (hydratedHist && hydratedHist.entries.length > 0) {
          setBackgroundHistory(hydratedHist);
          if (isBlendMode(histMeta?.blendMode)) {
            setBackgroundBlendMode(histMeta.blendMode);
          }
          if (
            typeof histMeta?.blendOpacity === "number" &&
            histMeta.blendOpacity >= 0 &&
            histMeta.blendOpacity <= 1
          ) {
            setBackgroundBlendOpacity(histMeta.blendOpacity);
          }
          const cur = hydratedHist.entries[hydratedHist.index];
          if (cur?.key) setBackgroundPreviewKey(cur.key);
        }
        setBackgroundPreviewImage(hydratedBg);

        prevLogoIdsRef.current = new Set(hydratedLogos.map((l) => l.id));
        prevMinisterAvatarIdsRef.current = new Set(hydratedMinisters.map((m) => m.avatar.id));
      } finally {
        if (!cancelled) setAssetsHydrated(true);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist Step 1 + Step 3 data so refresh doesn't wipe it.
  useEffect(() => {
    localStorage.setItem(LS_EVENT_DETAILS, JSON.stringify(eventDetails));
  }, [eventDetails]);

  useEffect(() => {
    const theme = (eventDetails.theme || "").trim();
    if (prevThemeForConceptsRef.current === null) {
      prevThemeForConceptsRef.current = theme;
      return;
    }
    if (prevThemeForConceptsRef.current === theme) return;
    prevThemeForConceptsRef.current = theme;

    setConcepts([]);
    setConceptsKey("");
    setSelectedConceptId(null);
    setCustomConceptText("");
    setBackgroundPreviewImage(null);
    setBackgroundPreviewKey("");
    setBackgroundHistory({ ...EMPTY_BACKGROUND_HIST });
    setBackgroundBlendMode("soft_light");
    setBackgroundBlendOpacity(0.45);
    setBackgroundRefinementNotes("");
    setFlyerImage(null);
    setFlyerKey("");
    setBaseColourChoice(null);
  }, [eventDetails.theme]);

  useEffect(() => {
    if (baseColourChoice == null) localStorage.removeItem(LS_BASE_COLOUR_CHOICE);
    else localStorage.setItem(LS_BASE_COLOUR_CHOICE, JSON.stringify(baseColourChoice));
  }, [baseColourChoice]);

  useEffect(() => {
    localStorage.setItem(LS_CONCEPTS, JSON.stringify(concepts));
  }, [concepts]);

  useEffect(() => {
    localStorage.setItem(LS_CONCEPTS_KEY, conceptsKey);
  }, [conceptsKey]);

  useEffect(() => {
    if (selectedConceptId == null) localStorage.removeItem(LS_SELECTED_CONCEPT_ID);
    else localStorage.setItem(LS_SELECTED_CONCEPT_ID, String(selectedConceptId));
  }, [selectedConceptId]);

  useEffect(() => {
    localStorage.setItem(LS_CUSTOM_CONCEPT_TEXT, customConceptText);
  }, [customConceptText]);

  useEffect(() => {
    localStorage.setItem(LS_FLYER_KEY, flyerKey);
  }, [flyerKey]);

  useEffect(() => {
    localStorage.setItem(LS_BACKGROUND_REFINEMENT, backgroundRefinementNotes);
  }, [backgroundRefinementNotes]);

  useEffect(() => {
    localStorage.setItem(LS_BACKGROUND_PREVIEW_KEY, backgroundPreviewKey);
  }, [backgroundPreviewKey]);

  useEffect(() => {
    if (!assetsHydrated) return;
    if (!backgroundPreviewImage) {
      localStorage.removeItem(LS_BACKGROUND_PREVIEW_META);
      void del(IDB_BACKGROUND_PREVIEW);
      return;
    }
    localStorage.setItem(LS_BACKGROUND_PREVIEW_META, JSON.stringify({ mimeType: backgroundPreviewImage.mimeType }));
    try {
      const bin = atob(backgroundPreviewImage.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      void putBlob(IDB_BACKGROUND_PREVIEW, new Blob([bytes], { type: backgroundPreviewImage.mimeType || "image/png" }), {
        name: "background-preview",
      });
    } catch {
      // ignore
    }
  }, [assetsHydrated, backgroundPreviewImage]);

  useEffect(() => {
    if (!assetsHydrated) return;
    const entries = backgroundHistory.entries;
    if (entries.length === 0) {
      localStorage.removeItem(LS_BACKGROUND_HISTORY_META);
      for (let i = 0; i < BG_HIST_STORAGE_SLOTS; i++) {
        void del(idbBackgroundHistDisplay(i));
        void del(idbBackgroundHistRaw(i));
      }
      return;
    }

    const meta: StoredBackgroundHistMeta = {
      baseKey: backgroundBaseCacheKey,
      index: backgroundHistory.index,
      entries: entries.map((e) => ({
        key: e.key,
        displayMime: e.image.mimeType,
        rawMime: e.rawAi?.mimeType ?? null,
      })),
      blendMode: backgroundBlendMode,
      blendOpacity: backgroundBlendOpacity,
    };
    localStorage.setItem(LS_BACKGROUND_HISTORY_META, JSON.stringify(meta));

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      try {
        const bin = atob(e.image.base64);
        const bytes = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
        void putBlob(idbBackgroundHistDisplay(i), new Blob([bytes], { type: e.image.mimeType || "image/png" }), {
          name: `bg-hist-${i}-display`,
        });
      } catch {
        /* ignore */
      }
      if (e.rawAi?.base64) {
        try {
          const bin = atob(e.rawAi.base64);
          const bytes = new Uint8Array(bin.length);
          for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
          void putBlob(idbBackgroundHistRaw(i), new Blob([bytes], { type: e.rawAi.mimeType || "image/png" }), {
            name: `bg-hist-${i}-raw`,
          });
        } catch {
          /* ignore */
        }
      } else {
        void del(idbBackgroundHistRaw(i));
      }
    }
    for (let i = entries.length; i < BG_HIST_STORAGE_SLOTS; i++) {
      void del(idbBackgroundHistDisplay(i));
      void del(idbBackgroundHistRaw(i));
    }
  }, [assetsHydrated, backgroundHistory, backgroundBaseCacheKey, backgroundBlendMode, backgroundBlendOpacity]);

  useEffect(() => {
    if (!assetsHydrated) return;
    // Persist flyer image in IndexedDB (safe for large blobs).
    if (!flyerImage) {
      localStorage.removeItem(LS_FLYER_IMAGE_META);
      void del(IDB_FLYER_IMAGE);
      return;
    }

    localStorage.setItem(LS_FLYER_IMAGE_META, JSON.stringify({ mimeType: flyerImage.mimeType }));
    try {
      const bin = atob(flyerImage.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      void putBlob(IDB_FLYER_IMAGE, new Blob([bytes], { type: flyerImage.mimeType || "image/png" }), { name: "flyer" });
    } catch {
      // ignore
    }
  }, [assetsHydrated, flyerImage]);

  useEffect(() => {
    if (!assetsHydrated) return;
    // Persist Step 2 logos to IndexedDB + localStorage refs.
    const current = new Set(logos.map((l) => l.id));
    const prev = prevLogoIdsRef.current;

    for (const id of prev) {
      if (!current.has(id)) void del(id);
    }
    for (const l of logos) {
      void putFile(l.id, l.file);
    }
    const refs: StoredFileRef[] = logos.map((l) => ({
      id: l.id,
      name: l.file.name,
      type: l.file.type || "application/octet-stream",
      lastModified: l.file.lastModified || Date.now(),
    }));
    localStorage.setItem(LS_LOGOS, JSON.stringify(refs));
    prevLogoIdsRef.current = current;
  }, [assetsHydrated, logos]);

  useEffect(() => {
    if (!assetsHydrated) return;
    // Persist Step 2 ministers to IndexedDB + localStorage refs.
    const currentAvatarIds = new Set(ministers.map((m) => m.avatar.id));
    const prev = prevMinisterAvatarIdsRef.current;

    for (const id of prev) {
      if (!currentAvatarIds.has(id)) void del(id);
    }
    for (const m of ministers) {
      void putFile(m.avatar.id, m.avatar.file);
    }

    const rows: StoredMinisterRow[] = ministers.map((m) => ({
      id: m.id,
      avatar: {
        id: m.avatar.id,
        name: m.avatar.file.name,
        type: m.avatar.file.type || "application/octet-stream",
        lastModified: m.avatar.file.lastModified || Date.now(),
      },
      name: m.name,
      title: m.title,
      placeholderName: m.placeholderName,
      placeholderTitle: m.placeholderTitle,
    }));
    localStorage.setItem(LS_MINISTERS, JSON.stringify(rows));
    prevMinisterAvatarIdsRef.current = currentAvatarIds;
  }, [assetsHydrated, ministers]);

  const value = useMemo<CreateDesignState>(
    () => ({
      eventDetails,
      setEventDetails,
      assetsHydrated,
      logos,
      setLogos,
      ministers,
      setMinisters,
      conceptsKey,
      setConceptsKey,
      concepts,
      setConcepts,
      selectedConceptId,
      setSelectedConceptId,
      customConceptText,
      setCustomConceptText,
      selectedConceptDescription,
      flyerKey,
      setFlyerKey,
      flyerImage,
      setFlyerImage,
      backgroundPreviewImage,
      setBackgroundPreviewImage,
      backgroundPreviewKey,
      setBackgroundPreviewKey,
      backgroundHistory,
      setBackgroundHistory,
      backgroundBlendMode,
      setBackgroundBlendMode,
      backgroundBlendOpacity,
      setBackgroundBlendOpacity,
      backgroundRefinementNotes,
      setBackgroundRefinementNotes,
      baseColourChoice,
      setBaseColourChoice,
    }),
    [
      assetsHydrated,
      backgroundBlendMode,
      backgroundBlendOpacity,
      backgroundHistory,
      backgroundPreviewImage,
      backgroundPreviewKey,
      backgroundRefinementNotes,
      baseColourChoice,
      concepts,
      conceptsKey,
      customConceptText,
      eventDetails,
      flyerImage,
      flyerKey,
      logos,
      ministers,
      selectedConceptDescription,
      selectedConceptId,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCreateDesign() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCreateDesign must be used within CreateDesignProvider");
  return ctx;
}


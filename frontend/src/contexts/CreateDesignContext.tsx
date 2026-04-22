import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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

  /** Step 3ii: AI-generated background preview (9:16), not the final flyer. */
  backgroundPreviewImage: FlyerImage | null;
  setBackgroundPreviewImage: (next: FlyerImage | null) => void;
  backgroundPreviewKey: string;
  setBackgroundPreviewKey: (next: string) => void;
  /** Optional notes from Step 3ii textarea when continuing (refinements). */
  backgroundRefinementNotes: string;
  setBackgroundRefinementNotes: (next: string) => void;
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

const IDB_FLYER_IMAGE = "flyerImage_v1";
const IDB_BACKGROUND_PREVIEW = "backgroundPreview_v1";

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
  const [backgroundRefinementNotes, setBackgroundRefinementNotes] = useState<string>(
    () => localStorage.getItem(LS_BACKGROUND_REFINEMENT) || ""
  );

  const prevLogoIdsRef = useRef<Set<string>>(new Set());
  const prevMinisterAvatarIdsRef = useRef<Set<string>>(new Set());

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

  // Hydrate Step 2 assets + Step 5 flyer image from storage (refresh-safe).
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const storedLogos = _safeJsonParse<StoredFileRef[]>(localStorage.getItem(LS_LOGOS)) ?? [];
        const storedMinisters = _safeJsonParse<StoredMinisterRow[]>(localStorage.getItem(LS_MINISTERS)) ?? [];
        const flyerMeta = _safeJsonParse<{ mimeType: string }>(localStorage.getItem(LS_FLYER_IMAGE_META));
        const bgMeta = _safeJsonParse<{ mimeType: string }>(localStorage.getItem(LS_BACKGROUND_PREVIEW_META));

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

        let hydratedBg: FlyerImage | null = null;
        if (bgMeta?.mimeType) {
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

  const selectedConceptDescription = useMemo(() => {
    if (selectedConceptId === CUSTOM_CONCEPT_ID) return customConceptText.trim();
    const c = concepts.find((x) => x.id === selectedConceptId);
    return (c?.description || concepts[0]?.description || "").trim();
  }, [concepts, customConceptText, selectedConceptId]);

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
      backgroundRefinementNotes,
      setBackgroundRefinementNotes,
    }),
    [
      assetsHydrated,
      backgroundPreviewImage,
      backgroundPreviewKey,
      backgroundRefinementNotes,
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


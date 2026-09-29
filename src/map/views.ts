export type MapViewRecord = {
  slug: string | null;
  updatedAt: number;
};

export type MapViewStore = {
  create: () => string;
  get: (id: string) => MapViewRecord | undefined;
  put: (id: string, slug: string | null) => MapViewRecord | undefined;
};

/** Process-lifetime UI focus; not the ledger. */
export function createMapViewStore(): MapViewStore {
  const views = new Map<string, MapViewRecord>();
  return {
    create() {
      const id = crypto.randomUUID();
      views.set(id, { slug: null, updatedAt: Date.now() });
      return id;
    },
    get(id) {
      return views.get(id);
    },
    put(id, slug) {
      if (!views.has(id)) return undefined;
      const rec = { slug, updatedAt: Date.now() };
      views.set(id, rec);
      return rec;
    },
  };
}

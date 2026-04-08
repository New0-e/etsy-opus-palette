const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/eeea6c70-e494-4b2f-8fbf-0dee3337901b";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/eeea6c70-e494-4b2f-8fbf-0dee3337901b";

// ── Types ──────────────────────────────────────────────────────────────────────

export type FicheFormData = {
  etsy_lien: string;
  lien_ali: string;
  boutique_nom: string;
  categorie: string;
  nom_du_produit: string;
  fiche_numero: string;
  caracteristiques_instructions: string;
};

export type QueueStatus = "pending" | "processing" | "done" | "error";

export type QueueItem = {
  id: string;
  form: FicheFormData;
  status: QueueStatus;
  label: string;
  testMode: boolean;
  errorMessage?: string;
};

export type QueueEvent = { type: "done" | "error"; item: QueueItem };

// ── Module-level state ─────────────────────────────────────────────────────────

let _queue: QueueItem[] = [];
let _processing = false;
let _cooldown = false;
let _paused = false;
const _stateListeners: Array<() => void> = [];
const _eventListeners: Array<(e: QueueEvent) => void> = [];

function _notify() {
  _stateListeners.forEach(fn => fn());
}

function _scheduleNext() {
  _cooldown = true;
  setTimeout(() => { _cooldown = false; _process(); }, 5000);
}

function _process() {
  if (_processing || _cooldown || _paused) return;
  const pending = _queue.find(i => i.status === "pending");
  if (!pending) return;

  _processing = true;
  _queue = _queue.map(i => i.id === pending.id ? { ...i, status: "processing" as QueueStatus } : i);
  _notify();

  const webhook = pending.testMode ? WEBHOOK_TEST : WEBHOOK_PROD;

  fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pending.form),
  })
    .then(async r => {
      _processing = false;
      // Try to read JSON body — n8n "Respond to Webhook" peut renvoyer un message
      let body: Record<string, unknown> = {};
      try { body = await r.json(); } catch { /* pas de JSON */ }

      // Erreur si : HTTP non-ok OU body contient un champ erreur (même en 200)
      const hasBodyError = !r.ok
        || body.error != null
        || body.success === false
        || body.status === "error";

      const status: QueueStatus = hasBodyError ? "error" : "done";
      const errorMessage = hasBodyError
        ? (typeof body.error === "string" ? body.error
          : typeof body.message === "string" ? body.message
          : !r.ok ? `Erreur HTTP ${r.status}`
          : undefined)
        : undefined;

      const updated: QueueItem = { ...pending, status, errorMessage };
      _queue = _queue.map(i => i.id === pending.id ? updated : i);
      if (hasBodyError) _paused = true;
      _notify();
      _eventListeners.forEach(fn => fn({ type: status as "done" | "error", item: updated }));
      if (!hasBodyError) _scheduleNext();
    })
    .catch(() => {
      _processing = false;
      const updated: QueueItem = { ...pending, status: "error", errorMessage: "Erreur de connexion" };
      _queue = _queue.map(i => i.id === pending.id ? updated : i);
      _paused = true;
      _notify();
      _eventListeners.forEach(fn => fn({ type: "error", item: updated }));
    });
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const queueStore = {
  getQueue: (): QueueItem[] => _queue,

  addItem(item: QueueItem) {
    _queue = [..._queue, item];
    _notify();
    _process();
  },

  isPaused: (): boolean => _paused,

  retryItem(id: string) {
    _queue = _queue.map(i => i.id === id ? { ...i, status: "pending" as QueueStatus } : i);
    _paused = false;
    _notify();
    _process();
  },

  removeItem(id: string) {
    _queue = _queue.filter(i => i.id !== id);
    _notify();
  },

  clearDone() {
    _queue = _queue.filter(i => i.status !== "done" && i.status !== "error");
    _notify();
  },

  /** Subscribe to queue state changes. Returns unsubscribe function. */
  subscribe(fn: () => void): () => void {
    _stateListeners.push(fn);
    return () => {
      const i = _stateListeners.indexOf(fn);
      if (i >= 0) _stateListeners.splice(i, 1);
    };
  },

  /** Subscribe to item completion events (done/error). Returns unsubscribe function. */
  onEvent(fn: (e: QueueEvent) => void): () => void {
    _eventListeners.push(fn);
    return () => {
      const i = _eventListeners.indexOf(fn);
      if (i >= 0) _eventListeners.splice(i, 1);
    };
  },
};

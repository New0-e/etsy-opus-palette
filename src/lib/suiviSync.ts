import { driveStore } from "./driveStore";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SuiviData = {
  version: 1;
  lastSaved: string;
  commandes: any[];
  linkedSheets: Record<string, string>;
  tauxImposition: string;
};

// ── Session cache des IDs Drive (évite de re-chercher à chaque save) ──────────

const SESSION_FOLDER_ID = "etsy-dash-folder-id";
const SESSION_FILE_ID   = "etsy-dash-file-id";
// Chemin cible : Mon Drive / Stockage / Suivi commande / etsy-dash-data.json
const FOLDER_PATH       = ["Stockage", "Suivi Commande"];
const FILE_NAME         = "etsy-dash-data.json";

// ── Helpers internes ──────────────────────────────────────────────────────────

function tok(): string | null {
  return driveStore.getToken();
}

// Trouve ou crée un dossier par nom dans un parent donné ("root" ou un ID de dossier)
async function findOrCreateFolderIn(name: string, parentId: string, token: string): Promise<string | null> {
  const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  try {
    const search = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (search.ok) {
      const data = await search.json();
      if (data.files?.[0]?.id) return data.files[0].id;
    }
    // Crée le dossier s'il n'existe pas
    const create = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
    });
    if (!create.ok) return null;
    const folder = await create.json();
    return folder.id;
  } catch { return null; }
}

// Navigue le chemin FOLDER_PATH depuis la racine, crée les dossiers manquants
async function findOrCreateFolder(): Promise<string | null> {
  const cached = sessionStorage.getItem(SESSION_FOLDER_ID);
  if (cached) return cached;

  const token = tok();
  if (!token) return null;

  try {
    let parentId = "root";
    for (const segment of FOLDER_PATH) {
      const id = await findOrCreateFolderIn(segment, parentId, token);
      if (!id) return null;
      parentId = id;
    }
    sessionStorage.setItem(SESSION_FOLDER_ID, parentId);
    return parentId;
  } catch { return null; }
}

async function findFile(folderId: string): Promise<string | null> {
  const cached = sessionStorage.getItem(SESSION_FILE_ID);
  if (cached) return cached;

  const token = tok();
  if (!token) return null;

  try {
    const q = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const id = data.files?.[0]?.id ?? null;
    if (id) sessionStorage.setItem(SESSION_FILE_ID, id);
    return id;
  } catch { return null; }
}

async function createFile(folderId: string, data: SuiviData): Promise<string | null> {
  const token = tok();
  if (!token) return null;

  const boundary = "etsy_dash_b";
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify({ name: FILE_NAME, parents: [folderId], mimeType: "application/json" }),
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    JSON.stringify(data),
    `--${boundary}--`,
  ].join("\r\n");

  try {
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    if (!res.ok) return null;
    const file = await res.json();
    sessionStorage.setItem(SESSION_FILE_ID, file.id);
    return file.id;
  } catch { return null; }
}

async function updateFile(fileId: string, data: SuiviData): Promise<boolean> {
  const token = tok();
  if (!token) return false;
  try {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    return res.ok;
  } catch { return false; }
}

// ── API publique ──────────────────────────────────────────────────────────────

/** Sauvegarde toutes les données sur Drive. Retourne true si succès. */
export async function saveToDrive(
  payload: Pick<SuiviData, "commandes" | "linkedSheets" | "tauxImposition">
): Promise<boolean> {
  if (!tok()) return false;
  try {
    const data: SuiviData = { version: 1, lastSaved: new Date().toISOString(), ...payload };
    const folderId = await findOrCreateFolder();
    if (!folderId) return false;

    const fileId = await findFile(folderId);
    if (fileId) return updateFile(fileId, data);

    return !!(await createFile(folderId, data));
  } catch { return false; }
}

/**
 * Charge les données depuis Drive.
 * Retourne null si Drive est inaccessible ou si le fichier n'existe pas encore.
 */
export async function loadFromDrive(): Promise<SuiviData | null> {
  if (!tok()) return null;
  try {
    const folderId = await findOrCreateFolder();
    if (!folderId) return null;

    const fileId = await findFile(folderId);
    if (!fileId) return null;

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${tok()!}` } }
    );
    if (!res.ok) return null;
    return await res.json() as SuiviData;
  } catch { return null; }
}

/** Vide le cache des IDs Drive (utile après déconnexion). */
export function clearDriveCache() {
  sessionStorage.removeItem(SESSION_FOLDER_ID);
  sessionStorage.removeItem(SESSION_FILE_ID);
}

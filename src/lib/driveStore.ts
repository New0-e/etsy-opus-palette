// ── Auth constants ─────────────────────────────────────────────────────────────
export const ALLOWED_EMAIL = "etimbleowen@gmail.com";
const TOKEN_KEY = "drive_access_token";
const EMAIL_KEY  = "drive_user_email";

// ── Module-level state ─────────────────────────────────────────────────────────
let _token: string | null = null;
let _email: string | null = null;
const _listeners: Array<() => void> = [];

// Auto-restore session on module load
{
  const t = sessionStorage.getItem(TOKEN_KEY);
  const e = sessionStorage.getItem(EMAIL_KEY);
  if (t && e === ALLOWED_EMAIL) {
    _token = t;
    _email = e;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface DriveFolder {
  id: string;
  name: string;
}

// ── Store ──────────────────────────────────────────────────────────────────────
export const driveStore = {
  // ── Token (legacy compat) ──────────────────────────────────────────────────
  setToken(t: string | null) { _token = t; },
  getToken: () => _token,

  // ── Auth ───────────────────────────────────────────────────────────────────
  setAuth(token: string, email: string) {
    _token = token;
    _email = email;
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EMAIL_KEY, email);
    _listeners.forEach(fn => fn());
  },

  logout() {
    _token = null;
    _email = null;
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    _listeners.forEach(fn => fn());
  },

  getEmail: () => _email,
  isAuthorized: () => _email === ALLOWED_EMAIL,

  onAuthChange(fn: () => void): () => void {
    _listeners.push(fn);
    return () => {
      const i = _listeners.indexOf(fn);
      if (i >= 0) _listeners.splice(i, 1);
    };
  },

  // ── Drive API ──────────────────────────────────────────────────────────────
  async fetchRootFolders(): Promise<DriveFolder[]> {
    if (!_token) return [];
    try {
      const q = "'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false";
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=200`,
        { headers: { Authorization: `Bearer ${_token}` } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return ((data.files ?? []) as DriveFolder[]).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
    } catch {
      return [];
    }
  },

  async updateSheetCell(
    spreadsheetId: string,
    sheetName: string,
    row: number,
    col: number,
    value: string
  ): Promise<boolean> {
    if (!_token) return false;
    let colStr = "";
    let c = col + 1;
    while (c > 0) {
      colStr = String.fromCharCode(64 + (c % 26 || 26)) + colStr;
      c = Math.floor((c - 1) / 26);
    }
    const a1 = `${sheetName}!${colStr}${row + 2}`;
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(a1)}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [[value]] }),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  // ── Google Docs API ────────────────────────────────────────────────────────
  async fetchDoc(docId: string): Promise<string | null> {
    if (!_token) return null;
    try {
      // Drive export works with drive.readonly — no documents scope needed
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${_token}` } }
      );
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  },

  async saveDoc(docId: string, text: string): Promise<boolean> {
    if (!_token) return false;
    try {
      // Get current doc structure via Docs API (requires documents scope)
      const res = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}`,
        { headers: { Authorization: `Bearer ${_token}` } }
      );
      if (res.status === 403) return false; // no documents scope yet
      if (!res.ok) return false;
      const doc = await res.json();
      const endIndex: number = doc.body?.content?.at(-1)?.endIndex ?? 1;

      const requests: object[] = [];
      if (endIndex > 1) {
        requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
      }
      if (text) {
        requests.push({ insertText: { location: { index: 1 }, text } });
      }

      const saveRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ requests }),
        }
      );
      return saveRes.ok;
    } catch {
      return false;
    }
  },

  async fetchAsFile(id: string, name: string): Promise<File | null> {
    if (!_token) return null;
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
        { headers: { Authorization: `Bearer ${_token}` } }
      );
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], name, { type: blob.type || "image/jpeg" });
    } catch {
      return null;
    }
  },
};

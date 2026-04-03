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

  // ── Diagnostics ───────────────────────────────────────────────────────────
  async checkTokenScopes(): Promise<string | null> {
    if (!_token) return null;
    try {
      const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${_token}`);
      const data = await res.json();
      return data.scope ?? null;
    } catch { return null; }
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
    gid: string,   // numeric sheet id from URL (?gid=...) — avoids needing sheet name
    row: number,   // 0-based data row (0 = first row after header)
    col: number,   // 0-based column
    value: string
  ): Promise<true | string | false> {
    if (!_token) return false;
    try {
      const sheetId = parseInt(gid, 10) || 0;
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              updateCells: {
                range: {
                  sheetId,
                  startRowIndex: row + 1, // +1 to skip header row
                  endRowIndex:   row + 2,
                  startColumnIndex: col,
                  endColumnIndex:   col + 1,
                },
                rows: [{ values: [{ userEnteredValue: { stringValue: value } }] }],
                fields: "userEnteredValue",
              },
            }],
          }),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[Sheets] batchUpdate → ${res.status}`, body);
        return `${res.status}` as any;
      }
      return true;
    } catch (e) {
      console.error("[Sheets] fetch error", e);
      return false;
    }
  },

  // ── Google Docs API ────────────────────────────────────────────────────────

  /** Creates a new tab in a Google Doc. Returns the new tabId or null on failure. */
  async createDocTab(docId: string, title: string): Promise<string | null> {
    if (!_token) return null;
    try {
      const res = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{ createTab: { tabProperties: { title } } }],
          }),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[Docs] createDocTab → ${res.status}`, body);
        return null;
      }
      const data = await res.json();
      return data.replies?.[0]?.createTab?.tabProperties?.tabId ?? null;
    } catch (e) {
      console.error("[Docs] createDocTab error", e);
      return null;
    }
  },

  /** Renames a tab in a Google Doc */
  async renameDocTab(docId: string, tabId: string, newTitle: string): Promise<boolean> {
    if (!_token) return false;
    try {
      const res = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{ updateTabProperties: { tabProperties: { tabId, title: newTitle }, fields: "title" } }],
          }),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[Docs] renameDocTab → ${res.status}`, body);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[Docs] renameDocTab error", e);
      return false;
    }
  },

  /** Fetches all tabs from a Google Doc. Returns null if documents scope missing. */
  async fetchDocTabs(docId: string): Promise<{ id: string; title: string; text: string }[] | null> {
    if (!_token) return null;
    try {
      const res = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`,
        { headers: { Authorization: `Bearer ${_token}` } }
      );
      if (!res.ok) return null;
      const doc = await res.json();
      const tabs: any[] = doc.tabs ?? [];
      if (tabs.length === 0) return null;
      return tabs.map(tab => {
        const id: string = tab.tabProperties?.tabId ?? "";
        const title: string = tab.tabProperties?.title ?? "Onglet";
        let text = "";
        const content: any[] = tab.documentTab?.body?.content ?? [];
        for (const el of content) {
          if (el.paragraph) {
            for (const pe of (el.paragraph.elements ?? [])) {
              if (pe.textRun?.content) text += pe.textRun.content;
            }
          }
        }
        return { id, title, text };
      });
    } catch {
      return null;
    }
  },

  /** Replaces the content of a specific tab. Returns false if documents scope missing (403). */
  async saveDocTab(docId: string, tabId: string, text: string): Promise<boolean | "no_scope"> {
    if (!_token) return false;
    try {
      // Get current endIndex for this tab
      const res = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}?includeTabsContent=true`,
        { headers: { Authorization: `Bearer ${_token}` } }
      );
      if (res.status === 401 || res.status === 403) return "no_scope";
      if (!res.ok) return false;
      const doc = await res.json();
      const tab = (doc.tabs ?? []).find((t: any) => t.tabProperties?.tabId === tabId);
      const endIndex: number = tab?.documentTab?.body?.content?.at(-1)?.endIndex ?? 1;

      const requests: object[] = [];
      if (endIndex > 1) {
        requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1, tabId } } });
      }
      if (text) {
        requests.push({ insertText: { location: { index: 1, tabId }, text } });
      }

      const saveRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ requests }),
        }
      );
      if (saveRes.status === 401 || saveRes.status === 403) return "no_scope";
      if (!saveRes.ok) {
        const body = await saveRes.text().catch(() => "");
        console.error(`[Docs] saveDocTab batchUpdate → ${saveRes.status} tabId=${tabId}`, body);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  /** Legacy single-doc fetch via Drive export (no documents scope needed) */
  async fetchDoc(docId: string): Promise<string | null> {
    if (!_token) return null;
    try {
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

  /** Legacy save — kept for compatibility */
  async saveDoc(docId: string, text: string): Promise<boolean> {
    if (!_token) return false;
    try {
      const res = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}`,
        { headers: { Authorization: `Bearer ${_token}` } }
      );
      if (!res.ok) return false;
      const doc = await res.json();
      const endIndex: number = doc.body?.content?.at(-1)?.endIndex ?? 1;
      const requests: object[] = [];
      if (endIndex > 1) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
      if (text) requests.push({ insertText: { location: { index: 1 }, text } });
      const saveRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
        { method: "POST", headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ requests }) }
      );
      return saveRes.ok;
    } catch {
      return false;
    }
  },

  /** Resolves a folder path like ["Stockage", "Bloc_note"] to its Drive folder ID */
  async resolveFolderPath(path: string[]): Promise<string | null> {
    if (!_token) return null;
    let parentId = "root";
    for (const segment of path) {
      const q = `'${parentId}' in parents and name='${segment}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      try {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
          { headers: { Authorization: `Bearer ${_token}` } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const id = data.files?.[0]?.id;
        if (!id) return null;
        parentId = id;
      } catch { return null; }
    }
    return parentId;
  },

  /** Lists all Google Docs in a folder */
  async listGDocsInFolder(folderId: string): Promise<{ id: string; name: string }[]> {
    if (!_token) return [];
    try {
      const q = `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name&pageSize=100`,
        { headers: { Authorization: `Bearer ${_token}` } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.files ?? [];
    } catch { return []; }
  },

  /** Creates a new Google Doc in a folder. Returns the new file ID or null. */
  async createGDoc(name: string, folderId: string): Promise<string | null> {
    if (!_token) return null;
    try {
      const res = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.document",
          parents: [folderId],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.id ?? null;
    } catch { return null; }
  },

  /** Permanently deletes a Drive file */
  async deleteFile(fileId: string): Promise<boolean> {
    if (!_token) return false;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${_token}` },
      });
      return res.status === 204;
    } catch { return false; }
  },

  /** Renames a Drive file */
  async renameFile(fileId: string, newName: string): Promise<boolean> {
    if (!_token) return false;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      return res.ok;
    } catch { return false; }
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

// Module-level token store shared between DrivePanel and dropzones
let _token: string | null = null;

export interface DriveFolder {
  id: string;
  name: string;
}

export const driveStore = {
  setToken(t: string | null) {
    _token = t;
  },
  getToken: () => _token,

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
    row: number,   // 0-indexed data row (excludes header)
    col: number,   // 0-indexed column
    value: string
  ): Promise<boolean> {
    if (!_token) return false;
    // Convert col index to A1 notation (0→A, 1→B, 25→Z, 26→AA …)
    let colStr = "";
    let c = col + 1;
    while (c > 0) {
      colStr = String.fromCharCode(64 + (c % 26 || 26)) + colStr;
      c = Math.floor((c - 1) / 26);
    }
    const a1 = `${sheetName}!${colStr}${row + 2}`; // +2: 1-indexed + skip header
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

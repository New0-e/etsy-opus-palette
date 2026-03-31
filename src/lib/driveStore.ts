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

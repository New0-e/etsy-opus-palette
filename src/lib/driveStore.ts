// Module-level token store shared between DrivePanel and dropzones
let _token: string | null = null;

export const driveStore = {
  setToken(t: string | null) {
    _token = t;
  },
  getToken: () => _token,

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

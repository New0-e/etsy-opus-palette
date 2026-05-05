const BASE = "https://n8n.srv1196541.hstgr.cloud";

function wh(path: string) {
  return {
    prod: `${BASE}/webhook/${path}`,
    test: `${BASE}/webhook-test/${path}`,
  };
}

export const N8N_BASE = BASE;

export const WEBHOOKS = {
  creationFiche:   wh("eeea6c70-e494-4b2f-8fbf-0dee3337901b"),
  generationPhotos: wh("edc44347-0c53-473e-8047-956afd36b4f4"),
  generationModele: wh("0075596e-85d8-4549-bb28-80ba00a727b9"),
  analyseImage:    wh("974dfca9-9cfb-4e18-bf37-58b1fd3cbd72"),
  analyseTags:     wh("43af0a2f-2584-4327-8527-ac204967a1cc"),
  tagsConcurrent:  wh("221b037d-2a18-4def-a350-0cdf5323197f"),
  descriptifImage: wh("fa1722ae-5d4a-4b96-b50c-2ff5d22f9227"),
  ideeSousNiche:   wh("749aeccd-3a6d-473d-b31a-756b5d7a702f"),
  downloadImages:  wh("upload-photos-brutes"),
  fondProduit:     wh("generate-background"),
} as const;

export function webhookUrl(key: keyof typeof WEBHOOKS, testMode: boolean): string {
  return testMode ? WEBHOOKS[key].test : WEBHOOKS[key].prod;
}

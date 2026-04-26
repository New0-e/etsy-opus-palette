export type FicheImportData = {
  etsy_lien: string;
  lien_ali: string;
  categorie: string;
  nom_du_produit: string;
  boutique_nom: string;
};

let _pending: FicheImportData | null = null;

export const ficheImportStore = {
  set: (data: FicheImportData) => { _pending = data; },
  get: () => _pending,
  clear: () => { _pending = null; },
};

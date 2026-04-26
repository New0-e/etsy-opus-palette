export type FicheImportData = {
  etsy_lien: string;
  lien_ali: string;
  categorie: string;
  nom_du_produit: string;
  boutique_nom: string;
  fiche_numero: string;
};

let _pending: FicheImportData | null = null;
const _listeners: Array<(data: FicheImportData) => void> = [];

export const ficheImportStore = {
  set: (data: FicheImportData) => {
    _pending = data;
    _listeners.forEach(fn => fn(data));
  },
  get: () => _pending,
  clear: () => { _pending = null; },
  subscribe: (fn: (data: FicheImportData) => void) => {
    _listeners.push(fn);
    return () => {
      const i = _listeners.indexOf(fn);
      if (i >= 0) _listeners.splice(i, 1);
    };
  },
};

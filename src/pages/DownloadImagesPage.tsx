import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, Check, AlertCircle, LogIn, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import TestModeBanner from "@/components/TestModeBanner";
import { driveStore } from "@/lib/driveStore";

const SHEET_ID = "1u3_-YtIYqCnO2YEPfLh1cCsjd2CcRiT1cKileCLA0Ig";
const GID = "0";
import { webhookUrl } from "@/config/webhooks";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let pos = 0;

  while (pos < src.length) {
    const row: string[] = [];
    let rowEmpty = true;

    while (pos < src.length && src[pos] !== "\n") {
      let cell = "";
      if (src[pos] === '"') {
        pos++;
        while (pos < src.length) {
          if (src[pos] === '"') {
            if (src[pos + 1] === '"') { cell += '"'; pos += 2; }
            else { pos++; break; }
          } else {
            cell += src[pos++];
          }
        }
        if (src[pos] === ",") pos++;
      } else {
        while (pos < src.length && src[pos] !== "," && src[pos] !== "\n") {
          cell += src[pos++];
        }
        if (src[pos] === ",") pos++;
      }
      if (cell) rowEmpty = false;
      row.push(cell);
    }
    if (src[pos] === "\n") pos++;
    if (!rowEmpty) rows.push(row);
  }
  return rows;
}

const PREVIEW_SIZE = 480;
const PREVIEW_GAP = 12;

function ImageThumb({ url, index, selected, onToggle, disablePreview }: {
  url: string;
  index: number;
  selected: boolean;
  onToggle: () => void;
  disablePreview?: boolean;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPreview = () => {
    if (disablePreview) return;
    timer.current = setTimeout(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      // Horizontal: centre sur la vignette, recadré si déborde
      let left = rect.left + rect.width / 2 - PREVIEW_SIZE / 2;
      left = Math.max(8, Math.min(left, vw - PREVIEW_SIZE - 8));

      // Vertical: au-dessus si la place suffit, sinon en-dessous
      let top: number;
      if (rect.top >= PREVIEW_SIZE + PREVIEW_GAP) {
        top = rect.top - PREVIEW_SIZE - PREVIEW_GAP;
      } else {
        top = rect.bottom + PREVIEW_GAP;
      }
      // Évite de dépasser le bas
      top = Math.min(top, vh - PREVIEW_SIZE - 8);

      setPos({ top, left });
    }, 500);
  };

  const hidePreview = () => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  };

  return (
    <div ref={containerRef} className="relative" onMouseEnter={showPreview} onMouseLeave={hidePreview}>
      <button
        onClick={onToggle}
        className={`relative rounded-lg overflow-hidden border-2 transition-all w-full ${
          selected ? "border-primary glow-primary" : "border-border hover:border-muted-foreground"
        }`}
      >
        <img src={url} alt={`Image ${index + 1}`} className="w-full aspect-square object-cover" />
        {selected && (
          <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </button>

      {pos && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg overflow-hidden border border-border shadow-2xl bg-background"
          style={{ top: pos.top, left: pos.left, width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
        >
          <img src={url} alt="Aperçu" className="w-full h-full object-contain" />
        </div>
      )}
    </div>
  );
}

interface ProductRow {
  boutique: string;
  numero: string;
  nom: string;
  imageUrls: string[];
  dossierPhotoId: string;
}

export default function DownloadImagesPage() {
  const isMobile = useIsMobile();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoutique, setSelectedBoutique] = useState("");
  const [selectedProductKey, setSelectedProductKey] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    const token = driveStore.getToken();
    if (!token) { setError("no_token"); setLoading(false); return; }

    fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then(r => { if (!r.ok) throw new Error(`Erreur ${r.status}`); return r.text(); })
      .then(text => {
        const parsed = parseCSV(text);
        if (parsed.length < 2) { setProducts([]); setLoading(false); return; }

        const [headers, ...dataRows] = parsed;

        const findCol = (...keywords: string[]) =>
          headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

        const boutiqueIdx  = findCol("boutique");
        const numeroIdx    = findCol("numéro", "numero", "num", "n°", "ref", "référence", "id");
        const nomIdx       = findCol("nom propre", "nom_propre", "nom");
        const urlsIdx      = findCol("urls image", "url image", "urls_image", "image_url", "images");
        const dossierIdx   = findCol("id_dossier_photo_brute", "dossier_photo", "dossier photo");

        const rows: ProductRow[] = dataRows
          .filter(row => row.some(c => c.trim()))
          .map(row => {
            const boutique  = boutiqueIdx >= 0 ? (row[boutiqueIdx] ?? "").trim() : "";
            const numero    = numeroIdx   >= 0 ? (row[numeroIdx]   ?? "").trim() : "";
            const nom       = nomIdx      >= 0 ? (row[nomIdx]      ?? "").trim() : "";
            const urlsRaw   = urlsIdx     >= 0 ? (row[urlsIdx]     ?? "").trim() : "";
            const imageUrls = urlsRaw
              .split(/[\n,]+/)
              .map(u => u.trim())
              .filter(u => /^https?:\/\//.test(u));
            const dossierPhotoId = dossierIdx >= 0 ? (row[dossierIdx] ?? "").trim() : "";
            return { boutique, numero, nom, imageUrls, dossierPhotoId };
          })
          .filter(p => p.boutique || p.nom);

        setProducts(rows);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const boutiques = [...new Set(products.map(p => p.boutique).filter(Boolean))]
    .filter(b => b.toLowerCase() !== "stockage")
    .sort();

  const filteredProducts = (selectedBoutique
    ? products.filter(p => p.boutique === selectedBoutique)
    : products
  ).slice().reverse();

  const activeProduct = products.find(
    p => `${p.numero}||${p.nom}` === selectedProductKey
  );

  const toggleImage = (url: string) =>
    setSelectedImages(prev =>
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    );

  const handleSend = async () => {
    if (!selectedImages.length) { toast.error("Sélectionnez au moins une image"); return; }
    setSending(true);
    try {
      const res = await fetch(webhookUrl("downloadImages", testMode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boutique: selectedBoutique,
          produit: activeProduct
            ? [activeProduct.numero, activeProduct.nom].filter(Boolean).join(" – ")
            : selectedProductKey,
          images: selectedImages,
          dossier_photo_id: activeProduct?.dossierPhotoId ?? "",
        }),
      });
      if (res.ok) {
        toast.success("Images envoyées au workflow !");
        setSelectedImages([]);
      } else {
        toast.error("Erreur lors de l'envoi");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSending(false);
    }
  };

  // ── States ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error === "no_token") return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-bold mb-6">Téléchargement Images</h1>
      <div className="tool-card flex flex-col items-center gap-4 py-12">
        <LogIn className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connecte ton Google Drive pour accéder au tableau</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-bold mb-6">Téléchargement Images</h1>
      <div className="tool-card flex flex-col items-center gap-3 py-12">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <TestModeBanner active={testMode} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Téléchargement Images</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>
      <div className="tool-card space-y-6">

        {/* 1. Boutique */}
        <div className="space-y-2">
          <Label>Boutiques</Label>
          <Select
            value={selectedBoutique}
            onValueChange={v => {
              setSelectedBoutique(v);
              setSelectedProductKey("");
              setSelectedImages([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une boutique" />
            </SelectTrigger>
            <SelectContent>
              {boutiques.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Produit */}
        <div className="space-y-2">
          <Label>Produit</Label>
          <Select
            value={selectedProductKey}
            onValueChange={v => { setSelectedProductKey(v); setSelectedImages([]); }}
            disabled={!selectedBoutique}
          >
            <SelectTrigger>
              <SelectValue placeholder={selectedBoutique ? "Sélectionner un produit" : "Choisissez d'abord une boutique"} />
            </SelectTrigger>
            <SelectContent>
              {filteredProducts.map(p => {
                const key   = `${p.numero}||${p.nom}`;
                const label = [p.numero, p.nom].filter(Boolean).join(" – ");
                return <SelectItem key={key} value={key}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>

        {/* 3. Images */}
        {activeProduct && (
          <>
            {activeProduct.imageUrls.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune image trouvée pour ce produit</p>
            ) : (
              <div>
                <Label className="mb-3 block">
                  Images disponibles ({activeProduct.imageUrls.length})
                  {selectedImages.length > 0 && (
                    <span className="ml-2 text-primary">{selectedImages.length} sélectionnée{selectedImages.length > 1 ? "s" : ""}</span>
                  )}
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {activeProduct.imageUrls.map((url, i) => (
                    <ImageThumb
                      key={i}
                      url={url}
                      index={i}
                      selected={selectedImages.includes(url)}
                      onToggle={() => toggleImage(url)}
                      disablePreview={isMobile}
                    />
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={sending || selectedImages.length === 0}
              className="gap-2"
            >
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              {sending ? "Envoi en cours…" : `Télécharger (${selectedImages.length})`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

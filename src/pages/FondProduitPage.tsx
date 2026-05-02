import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, Sparkles, FlaskConical, Download } from "lucide-react";
import { toast } from "sonner";

const PROXY_URL = "/api/n8n-proxy-background";

export default function FondProduitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  }, []);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
  };

  const handleGenerer = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "X-Test-Mode": testMode ? "1" : "0" },
        body: formData,
      });
      if (res.status === 404) {
        toast.error("Webhook introuvable — en mode test, lancez d'abord un test dans n8n");
        return;
      }
      if (!res.ok) {
        toast.error(`Erreur serveur : ${res.status}`);
        return;
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.startsWith("image/")) {
        const blob = await res.blob();
        setResult(URL.createObjectURL(blob));
        toast.success("Fond généré !");
      } else {
        const raw = await res.text();
        let imgUrl: string | null = null;
        try {
          const data = JSON.parse(raw);
          // cherche récursivement la première valeur qui ressemble à une URL d'image ou base64
          const find = (obj: unknown): string | null => {
            if (typeof obj === "string") {
              if (obj.startsWith("data:image") || obj.match(/\.(png|jpg|jpeg|webp|gif)(\?|$)/i) || obj.startsWith("http")) return obj;
            }
            if (Array.isArray(obj)) {
              for (const v of obj) { const r = find(v); if (r) return r; }
            }
            if (obj && typeof obj === "object") {
              for (const v of Object.values(obj as Record<string, unknown>)) { const r = find(v); if (r) return r; }
            }
            return null;
          };
          imgUrl = find(data);
        } catch {
          // réponse brute non-JSON : peut-être une URL directe
          if (raw.startsWith("http") || raw.startsWith("data:image")) imgUrl = raw.trim();
        }
        if (imgUrl) {
          setResult(imgUrl);
          toast.success("Fond généré !");
        } else {
          toast.error("Réponse reçue mais aucune image trouvée");
          console.error("Réponse n8n :", raw);
        }
      }
    } catch {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Fond Produit</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>

      <div className="tool-card space-y-6">
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Image du produit</label>
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
          >
            {preview ? (
              <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg" />
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Glissez une image ici</p>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" id="fond-produit-img" onChange={onInput} />
            <label htmlFor="fond-produit-img" className="text-xs text-primary cursor-pointer hover:underline mt-2 inline-block">
              {preview ? "Changer l'image" : "Parcourir"}
            </label>
          </div>
        </div>

        <Button onClick={handleGenerer} disabled={!file || loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Génération en cours..." : "Générer"}
        </Button>
      </div>

      {result && (
        <div className="tool-card space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Image générée</span>
            <a
              href={result}
              download="fond-produit.png"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Download className="h-4 w-4" />
              Télécharger
            </a>
          </div>
          <img
            src={result}
            alt="fond généré"
            className="w-full rounded-lg border border-border shadow-sm"
            onError={() => toast.error("Impossible d'afficher l'image")}
          />
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Check } from "lucide-react";
import { toast } from "sonner";

// Mock products - in reality these would come from the Google Sheet
const mockProducts = [
  { name: "Collier Lune Argent", images: ["https://placehold.co/300x300/1a1a2e/e2725b?text=Image+1", "https://placehold.co/300x300/1a1a2e/e2725b?text=Image+2", "https://placehold.co/300x300/1a1a2e/e2725b?text=Image+3"] },
  { name: "Bague Minimaliste Or", images: ["https://placehold.co/300x300/1a1a2e/e2725b?text=Image+A", "https://placehold.co/300x300/1a1a2e/e2725b?text=Image+B"] },
];

export default function DownloadImagesPage() {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const product = mockProducts.find((p) => p.name === selectedProduct);

  const toggleImage = (url: string) => {
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const handleDownload = async () => {
    if (selectedImages.length === 0) {
      toast.error("Sélectionnez au moins une image");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://n8n.srv1196541.hstgr.cloud/webhook/upload-photos-brutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: selectedProduct, images: selectedImages }),
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
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-bold mb-6">Téléchargement Images</h1>
      <div className="tool-card space-y-6">
        <div className="space-y-2">
          <Label>Nom du Produit</Label>
          <Select value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v); setSelectedImages([]); }}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
            <SelectContent>
              {mockProducts.map((p) => (
                <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {product && (
          <>
            <div>
              <Label className="mb-3 block">Images disponibles ({product.images.length})</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {product.images.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => toggleImage(url)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImages.includes(url) ? "border-primary glow-primary" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <img src={url} alt={`Image ${i + 1}`} className="w-full aspect-square object-cover" />
                    {selectedImages.includes(url) && (
                      <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleDownload} disabled={loading || selectedImages.length === 0} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {loading ? "Envoi..." : `Télécharger (${selectedImages.length})`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

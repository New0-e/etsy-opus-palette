import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function toEmbedUrl(url: string): string {
  // Garde le mode édition mais retire les fragments (#gid=...) qui causent des problèmes
  // et ajoute rm=minimal pour une interface allégée
  const base = url.replace(/#.*$/, "");
  if (base.includes("/edit")) {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}rm=minimal`;
  }
  return base;
}

export default function ViewerPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  const rawUrl = params.get("url") ?? "";
  const title = params.get("title") ?? "Document";
  const url = decodeURIComponent(rawUrl);
  const embedUrl = toEmbedUrl(url);

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Barre titre */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <span className="font-medium text-sm truncate flex-1 text-foreground">{title}</span>
        <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir
          </Button>
        </a>
      </div>

      {/* Iframe */}
      <div className="relative flex-1">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <iframe
          src={embedUrl}
          className="w-full h-full border-0"
          onLoad={() => setLoaded(true)}
          title={title}
          allow="autoplay"
        />
      </div>
    </div>
  );
}

import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetsViewer } from "@/components/SheetsViewer";
import { driveStore } from "@/lib/driveStore";
import { useState, useEffect } from "react";

function isGoogleSheet(url: string) { return url.includes("/spreadsheets/"); }
function isGoogleDoc(url: string) { return url.includes("/document/"); }
function isDrivePreview(url: string) { return url.includes("drive.google.com/file/d/"); }

function extractFileId(url: string): string | null {
  return url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;
}

function PDFViewer({ url }: { url: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    const fileId = extractFileId(url);
    const token = driveStore.getToken();
    if (!fileId || !token) { setError(true); setLoading(false); return; }

    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.blob(); })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-destructive">Impossible de charger le PDF</p>
      <a href={url} target="_blank" rel="noreferrer">
        <Button variant="outline" className="gap-2">
          <ExternalLink className="h-4 w-4" />
          Ouvrir dans Drive
        </Button>
      </a>
    </div>
  );
  return <iframe src={blobUrl!} className="w-full h-full border-0" title="PDF" />;
}

export default function ViewerPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const rawUrl = params.get("url") ?? "";
  const title = params.get("title") ?? "Document";
  const url = decodeURIComponent(rawUrl);

  const sheet = isGoogleSheet(url);
  const doc = isGoogleDoc(url);
  const pdf = isDrivePreview(url);

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

      {/* Contenu */}
      <div className="flex-1 overflow-hidden">
        {sheet && <SheetsViewer url={url} title={title} />}

        {doc && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <FileText className="h-12 w-12 text-blue-400" />
            <div>
              <p className="font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Google bloque l'affichage des Docs dans des applications tierces.
              </p>
            </div>
            <a href={url} target="_blank" rel="noreferrer">
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ouvrir dans Google Docs
              </Button>
            </a>
          </div>
        )}

        {pdf && <PDFViewer url={url} />}

        {!sheet && !doc && !pdf && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-sm text-muted-foreground">Type de fichier non supporté</p>
            <a href={url} target="_blank" rel="noreferrer">
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ouvrir
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

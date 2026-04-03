import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetsViewer } from "@/components/SheetsViewer";

function isGoogleSheet(url: string) { return url.includes("/spreadsheets/"); }
function isGoogleDoc(url: string) { return url.includes("/document/"); }
function isDrivePreview(url: string) { return url.includes("drive.google.com/file/d/"); }

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

        {pdf && (
          <iframe
            src={url}
            className="w-full h-full border-0"
            allow="autoplay"
            title={title}
          />
        )}

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

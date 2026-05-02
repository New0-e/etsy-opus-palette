import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight, Folder, PanelRightClose, PanelRightOpen,
  Loader2, ExternalLink, LogOut, FileText, Image, Table2, Home, RefreshCw, FileType2, Film,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { driveStore } from "@/lib/driveStore";

// ── Drive API ─────────────────────────────────────────────────────────────────

const MIME_FOLDER = "application/vnd.google-apps.folder";
const MIME_DOC    = "application/vnd.google-apps.document";
const MIME_SHEET  = "application/vnd.google-apps.spreadsheet";
const MIME_PDF    = "application/pdf";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

function naturalSort(a: DriveItem, b: DriveItem): number {
  const af = a.mimeType === MIME_FOLDER;
  const bf = b.mimeType === MIME_FOLDER;
  if (af !== bf) return af ? -1 : 1;
  if (af && bf) {
    // Folders: descending order (largest number first)
    return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: "base" });
  }
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

async function fetchFolderContents(
  token: string,
  parentId: string,
  foldersOnly: boolean,
): Promise<DriveItem[]> {
  let q = `'${parentId}' in parents and trashed=false`;
  if (foldersOnly) {
    q += ` and mimeType='${MIME_FOLDER}'`;
  } else {
    q += ` and (mimeType='${MIME_FOLDER}' or mimeType='${MIME_DOC}' or mimeType='${MIME_SHEET}' or mimeType='${MIME_PDF}' or mimeType contains 'image/' or mimeType contains 'video/')`;
  }
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 401) throw new Error("token_expired");
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  const data = await res.json();
  const items = ((data.files ?? []) as DriveItem[])
    .filter(f => !f.name.startsWith("."))
    .sort(naturalSort);
  // Preload thumbnails
  items.forEach(item => {
    if (item.thumbnailLink) {
      const img = new window.Image();
      img.src = item.thumbnailLink;
    }
  });
  return items;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type NavEntry = { id: string; name: string };

// ── Component ─────────────────────────────────────────────────────────────────

export function DrivePanel({ mobileOpen = false, onMobileToggle }: { mobileOpen?: boolean; onMobileToggle?: () => void } = {}) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(() => !window.matchMedia("(max-width: 767px)").matches);
  const isOpen = isMobile ? mobileOpen : internalOpen;
  const toggleOpen = () => isMobile ? onMobileToggle?.() : setInternalOpen(v => !v);
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRoot = navStack.length === 0;
  const currentId = isRoot ? "root" : navStack[navStack.length - 1].id;

  // Load contents of the current folder
  const loadCurrent = useCallback(async (folderId: string, root: boolean) => {
    const token = driveStore.getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFolderContents(token, folderId, root);
      setItems(result);
    } catch (e) {
      if ((e as Error).message === "token_expired") {
        driveStore.handleExpiredToken();
      } else {
        setError("Impossible de charger le Drive");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrent(currentId, isRoot);
  }, [currentId, isRoot, loadCurrent]);

  const navigateInto = (item: DriveItem) => {
    setNavStack(prev => [...prev, { id: item.id, name: item.name }]);
  };

  const navigateTo = (idx: number) => {
    // idx = -1 → root, idx >= 0 → that level
    setNavStack(prev => prev.slice(0, idx + 1));
  };

  const containerClass = isMobile
    ? isOpen
      ? "fixed inset-0 z-50 bg-background flex flex-col"
      : "hidden"
    : `border-l border-border bg-drive transition-all duration-300 flex flex-col h-full ${isOpen ? "w-64" : "w-10"}`;

  return (
    <>

    <div className={containerClass}>

      {/* Header */}
      <div className="p-2 flex items-center justify-between border-b border-border flex-shrink-0">
        {(isOpen || !isMobile) && (
          <div className="flex items-center gap-1 px-1 min-w-0 flex-1">
            <span className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0">Drive</span>
            <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground ml-1 flex-shrink-0">
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={() => loadCurrent(currentId, isRoot)}
              className="text-muted-foreground hover:text-foreground ml-0.5 flex-shrink-0"
              title="Actualiser"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
            <button
              onClick={() => driveStore.logout()}
              className="text-muted-foreground hover:text-foreground ml-0.5 flex-shrink-0"
              title="Déconnecter"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={toggleOpen}>
          {isOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {isOpen && (
        <>
          {/* Breadcrumb */}
          {!isRoot && (
            <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-secondary/20 flex-shrink-0 overflow-x-auto">
              <button
                onClick={() => navigateTo(-1)}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="Racine"
              >
                <Home className="h-3.5 w-3.5" />
              </button>
              {navStack.map((entry, idx) => (
                <div key={entry.id} className="flex items-center gap-0.5 flex-shrink-0">
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                  <button
                    onClick={() => navigateTo(idx)}
                    className={`text-xs truncate max-w-[80px] transition-colors ${
                      idx === navStack.length - 1
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={entry.name}
                  >
                    {entry.name}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File list */}
          <ScrollArea className="flex-1 p-2">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-xs text-destructive text-center py-4">{error}</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {isRoot ? "Aucun dossier à la racine" : "Dossier vide"}
              </p>
            ) : (
              items.map(item => (
                <DriveItemRow
                  key={item.id}
                  item={item}
                  onNavigateInto={navigateInto}
                />
              ))
            )}
          </ScrollArea>
        </>
      )}
    </div>
    </>
  );
}

// ── DriveItemRow ──────────────────────────────────────────────────────────────

function DriveItemRow({
  item,
  onNavigateInto,
}: {
  item: DriveItem;
  onNavigateInto: (item: DriveItem) => void;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isFolder = item.mimeType === MIME_FOLDER;
  const isImage  = item.mimeType.startsWith("image/");
  const isVideo  = item.mimeType.startsWith("video/");
  const isSheet  = item.mimeType === MIME_SHEET;
  const isDoc    = item.mimeType === MIME_DOC;
  const isPdf    = item.mimeType === MIME_PDF;

  if (isFolder) {
    return (
      <button
        onClick={() => onNavigateInto(item)}
        className="flex items-center gap-2 w-full py-1.5 px-2 rounded-md text-sm text-sidebar-foreground hover:bg-drive-hover transition-colors"
      >
        <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="truncate text-left">{item.name}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto flex-shrink-0" />
      </button>
    );
  }

  const icon = isImage
    ? <Image className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    : isVideo
      ? <Film className="h-4 w-4 text-purple-400 flex-shrink-0" />
      : isSheet
        ? <Table2 className="h-4 w-4 text-green-400 flex-shrink-0" />
        : isPdf
          ? <FileType2 className="h-4 w-4 text-red-400 flex-shrink-0" />
          : <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />;

  const handleClick = (isDoc || isSheet || isPdf)
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        const viewUrl = isPdf
          ? `https://drive.google.com/file/d/${item.id}/preview`
          : (item.webViewLink ?? "");
        navigate(`/viewer?url=${encodeURIComponent(viewUrl)}&title=${encodeURIComponent(item.name)}`);
      }
    : undefined;

  const row = (
    <a
      href={item.webViewLink ?? "#"}
      target={(isDoc || isSheet) ? "_self" : "_blank"}
      rel="noreferrer"
      onClick={handleClick}
      draggable={(isImage || isVideo) && !isMobile}
      onDragStart={((isImage || isVideo) && !isMobile) ? e => {
        e.dataTransfer.setData("drive-item-id", item.id);
        e.dataTransfer.setData("drive-item-name", item.name);
        e.dataTransfer.effectAllowed = "copy";
      } : undefined}
      className={`flex items-center gap-2 w-full py-1.5 px-2 rounded-md text-sm text-sidebar-foreground hover:bg-drive-hover transition-colors ${(isImage || isVideo) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <span className="w-3 flex-shrink-0" />
      {isMobile && (isImage || isVideo) && item.thumbnailLink
        ? <img src={item.thumbnailLink} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
        : icon}
      <span className="truncate">{item.name}</span>
    </a>
  );

  if ((isImage || isVideo) && item.thumbnailLink && !isMobile) {
    return (
      <HoverCard openDelay={100} closeDelay={50}>
        <HoverCardTrigger asChild>{row}</HoverCardTrigger>
        <HoverCardContent side="left" className="w-48 p-1 border-border bg-popover">
          <img src={item.thumbnailLink} alt={item.name} className="rounded w-full object-cover" />
          <p className="text-xs text-muted-foreground mt-1 truncate px-1">{item.name}</p>
        </HoverCardContent>
      </HoverCard>
    );
  }

  return row;
}

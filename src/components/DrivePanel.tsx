import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Folder, FolderOpen, PanelRightClose, PanelRightOpen, LogIn, Loader2, ExternalLink, LogOut, FileText, Image, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { driveStore } from "@/lib/driveStore";

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string).trim();
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_KEY = "drive_access_token";
const VERIFIER_KEY = "drive_pkce_verifier";

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function redirectUri(): string {
  return window.location.origin;
}

// ── Drive API ─────────────────────────────────────────────────────────────────

const MIME_FOLDER = "application/vnd.google-apps.folder";
const MIME_DOC = "application/vnd.google-apps.document";
const MIME_SHEET = "application/vnd.google-apps.spreadsheet";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

function naturalSort(a: DriveItem, b: DriveItem): number {
  // Folders first, then files
  const aIsFolder = a.mimeType === MIME_FOLDER;
  const bIsFolder = b.mimeType === MIME_FOLDER;
  if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

async function fetchItems(accessToken: string, parentId: string): Promise<DriveItem[]> {
  const q = `'${parentId}' in parents and trashed=false and (mimeType='${MIME_FOLDER}' or mimeType='${MIME_DOC}' or mimeType='${MIME_SHEET}' or mimeType contains 'image/')`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=200`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 401) throw new Error("token_expired");
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  const data = await res.json();
  const items = ((data.files ?? []) as DriveItem[]).sort(naturalSort);
  // Précharger les thumbnails en arrière-plan pour un affichage instantané au hover
  items.forEach((item) => {
    if (item.thumbnailLink) {
      const img = new window.Image();
      img.src = item.thumbnailLink;
    }
  });
  return items;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DrivePanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [rootItems, setRootItems] = useState<DriveItem[]>([]);
  const [childrenMap, setChildrenMap] = useState<Record<string, DriveItem[]>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep driveStore in sync with the token
  useEffect(() => { driveStore.setToken(accessToken); }, [accessToken]);

  const loadRootItems = useCallback(async (token: string) => {
    setIsInitialLoading(true);
    setError(null);
    try {
      const items = await fetchItems(token, "root");
      setRootItems(items);
    } catch (e) {
      if ((e as Error).message === "token_expired") {
        sessionStorage.removeItem(TOKEN_KEY);
        setAccessToken(null);
        setError("Session expirée, reconnecte-toi");
      } else {
        setError("Impossible de charger le Drive");
      }
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Pick up OAuth code after redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    if (!code || !verifier) return;

    window.history.replaceState(null, "", window.location.pathname);
    sessionStorage.removeItem(VERIFIER_KEY);

    setIsInitialLoading(true);
    fetch("/api/google-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: redirectUri(), code_verifier: verifier }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        sessionStorage.setItem(TOKEN_KEY, data.access_token);
        setAccessToken(data.access_token);
        loadRootItems(data.access_token);
      })
      .catch((e) => {
        setError("Connexion échouée : " + (e as Error).message);
        setIsInitialLoading(false);
      });
  }, [loadRootItems]);

  // Load items when token already stored
  useEffect(() => {
    if (accessToken && rootItems.length === 0) {
      loadRootItems(accessToken);
    }
  }, [accessToken, loadRootItems, rootItems.length]);

  const handleLogin = async () => {
    const verifier = generateVerifier();
    const challenge = await generateChallenge(verifier);
    sessionStorage.setItem(VERIFIER_KEY, verifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "online",
      prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setAccessToken(null);
    setRootItems([]);
    setChildrenMap({});
    setExpandedIds(new Set());
    setError(null);
  };

  const toggleFolder = useCallback(async (item: DriveItem) => {
    const { id } = item;
    if (expandedIds.has(id)) {
      setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      return;
    }
    setExpandedIds((prev) => new Set([...prev, id]));
    if (childrenMap[id]) return;
    setLoadingIds((prev) => new Set([...prev, id]));
    try {
      const children = await fetchItems(accessToken!, id);
      setChildrenMap((prev) => ({ ...prev, [id]: children }));
    } finally {
      setLoadingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, [accessToken, childrenMap, expandedIds]);

  return (
    <div className={`border-l border-border bg-drive transition-all duration-300 flex flex-col h-full ${isOpen ? "w-64" : "w-10"}`}>
      <div className="p-2 flex items-center justify-between border-b border-border">
        {isOpen && (
          <div className="flex items-center gap-1 px-2">
            <span className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Drive</span>
            {accessToken && (
              <>
                <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground ml-1" title="Déconnecter">
                  <LogOut className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {isOpen && (
        <ScrollArea className="flex-1 p-2">
          {isInitialLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : !accessToken ? (
            <div className="flex flex-col items-center gap-3 py-6 px-2">
              <p className="text-xs text-muted-foreground text-center">
                Connecte ton Google Drive pour voir tes dossiers
              </p>
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={handleLogin}>
                <LogIn className="h-3.5 w-3.5" />
                Connecter Drive
              </Button>
            </div>
          ) : (
            <>
              {rootItems.map((item) => (
                <DriveItemRow
                  key={item.id}
                  item={item}
                  expandedIds={expandedIds}
                  loadingIds={loadingIds}
                  childrenMap={childrenMap}
                  onToggle={toggleFolder}
                  depth={0}
                />
              ))}
              {rootItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun élément trouvé</p>
              )}
            </>
          )}
        </ScrollArea>
      )}
    </div>
  );
}

function DriveItemRow({
  item, expandedIds, loadingIds, childrenMap, onToggle, depth,
}: {
  item: DriveItem;
  expandedIds: Set<string>;
  loadingIds: Set<string>;
  childrenMap: Record<string, DriveItem[]>;
  onToggle: (item: DriveItem) => void;
  depth: number;
}) {
  const navigate = useNavigate();
  const isFolder = item.mimeType === MIME_FOLDER;
  const isExpanded = expandedIds.has(item.id);
  const isLoading = loadingIds.has(item.id);
  const children = childrenMap[item.id];
  const pl = `${8 + depth * 12}px`;

  if (!isFolder) {
    const isImage = item.mimeType.startsWith("image/");
    const isSheet = item.mimeType === MIME_SHEET;
    const isViewable = item.mimeType === MIME_DOC || isSheet;

    const handleClick = isViewable
      ? (e: React.MouseEvent) => {
          e.preventDefault();
          navigate(`/viewer?url=${encodeURIComponent(item.webViewLink ?? "")}&title=${encodeURIComponent(item.name)}`);
        }
      : undefined;

    const icon = isImage
      ? <Image className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      : isSheet
        ? <Table2 className="h-4 w-4 text-green-400 flex-shrink-0" />
        : <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />;

    const row = (
      <a
        href={item.webViewLink ?? "#"}
        target={isViewable ? "_self" : "_blank"}
        rel="noreferrer"
        onClick={handleClick}
        draggable={isImage}
        onDragStart={isImage ? (e) => {
          e.dataTransfer.setData("drive-item-id", item.id);
          e.dataTransfer.setData("drive-item-name", item.name);
          e.dataTransfer.effectAllowed = "copy";
        } : undefined}
        className={`flex items-center gap-2 w-full py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-drive-hover transition-colors ${isImage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
        style={{ paddingLeft: pl, paddingRight: "8px" }}
      >
        <span className="w-3 flex-shrink-0" />
        {icon}
        <span className="truncate">{item.name}</span>
      </a>
    );

    if (isImage && item.thumbnailLink) {
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

  return (
    <div>
      <button
        onClick={() => onToggle(item)}
        className="flex items-center gap-2 w-full py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-drive-hover transition-colors"
        style={{ paddingLeft: pl, paddingRight: "8px" }}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
        ) : (
          <ChevronRight className={`h-3 w-3 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
        )}
        {isExpanded
          ? <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
          : <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
        <span className="truncate text-left">{item.name}</span>
      </button>
      {isExpanded && children && (
        <div>
          {children.map((child) => (
            <DriveItemRow key={child.id} item={child} expandedIds={expandedIds} loadingIds={loadingIds} childrenMap={childrenMap} onToggle={onToggle} depth={depth + 1} />
          ))}
          {children.length === 0 && (
            <p className="text-xs text-muted-foreground py-1" style={{ paddingLeft: `${20 + depth * 12}px` }}>Dossier vide</p>
          )}
        </div>
      )}
    </div>
  );
}

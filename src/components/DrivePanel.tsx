import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronRight, Folder, FolderOpen, PanelRightClose, PanelRightOpen, LogIn, Loader2, ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_KEY = "drive_access_token";

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const existing = document.getElementById("gis-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

interface DriveFolder {
  id: string;
  name: string;
}

async function fetchFolders(accessToken: string, parentId: string): Promise<DriveFolder[]> {
  const query = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 401) throw new Error("token_expired");
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  const data = await res.json();
  return (data.files ?? []) as DriveFolder[];
}

export function DrivePanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [rootFolders, setRootFolders] = useState<DriveFolder[]>([]);
  const [childrenMap, setChildrenMap] = useState<Record<string, DriveFolder[]>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenClientRef = useRef<{ requestAccessToken: () => void } | null>(null);

  const loadRootFolders = useCallback(async (token: string) => {
    setIsInitialLoading(true);
    setError(null);
    try {
      const folders = await fetchFolders(token, "root");
      setRootFolders(folders);
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

  // Load GIS and init token client on mount
  useEffect(() => {
    loadGisScript().then(() => {
      tokenClientRef.current = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (response) => {
          if (response.error || !response.access_token) {
            setError("Connexion échouée : " + (response.error ?? "token manquant"));
            return;
          }
          sessionStorage.setItem(TOKEN_KEY, response.access_token);
          setAccessToken(response.access_token);
          setRootFolders([]);
          loadRootFolders(response.access_token);
        },
      });
    });
  }, [loadRootFolders]);

  // Load folders if token already in session
  useEffect(() => {
    if (accessToken && rootFolders.length === 0) {
      loadRootFolders(accessToken);
    }
  }, [accessToken, loadRootFolders, rootFolders.length]);

  const handleLogin = () => {
    if (!tokenClientRef.current) {
      setError("Bibliothèque Google non chargée, réessaie");
      return;
    }
    tokenClientRef.current.requestAccessToken();
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setAccessToken(null);
    setRootFolders([]);
    setChildrenMap({});
    setExpandedIds(new Set());
    setError(null);
  };

  const toggleFolder = useCallback(async (folder: DriveFolder) => {
    const { id } = folder;

    if (expandedIds.has(id)) {
      setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      return;
    }

    setExpandedIds((prev) => new Set([...prev, id]));

    if (childrenMap[id]) return;

    setLoadingIds((prev) => new Set([...prev, id]));
    try {
      const children = await fetchFolders(accessToken!, id);
      setChildrenMap((prev) => ({ ...prev, [id]: children }));
    } finally {
      setLoadingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, [accessToken, childrenMap, expandedIds]);

  return (
    <div className={`border-l border-border bg-drive transition-all duration-300 flex flex-col ${isOpen ? "w-64" : "w-10"}`}>
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
          {!accessToken ? (
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
          ) : isInitialLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {rootFolders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  expandedIds={expandedIds}
                  loadingIds={loadingIds}
                  childrenMap={childrenMap}
                  onToggle={toggleFolder}
                  depth={0}
                />
              ))}
              {rootFolders.length === 0 && !isInitialLoading && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun dossier trouvé</p>
              )}
            </>
          )}
        </ScrollArea>
      )}
    </div>
  );
}

function FolderItem({
  folder,
  expandedIds,
  loadingIds,
  childrenMap,
  onToggle,
  depth,
}: {
  folder: DriveFolder;
  expandedIds: Set<string>;
  loadingIds: Set<string>;
  childrenMap: Record<string, DriveFolder[]>;
  onToggle: (folder: DriveFolder) => void;
  depth: number;
}) {
  const isExpanded = expandedIds.has(folder.id);
  const isLoading = loadingIds.has(folder.id);
  const children = childrenMap[folder.id];

  return (
    <div>
      <button
        onClick={() => onToggle(folder)}
        className="flex items-center gap-2 w-full py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-drive-hover transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: "8px" }}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
        ) : (
          <ChevronRight className={`h-3 w-3 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
        )}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="truncate text-left">{folder.name}</span>
      </button>

      {isExpanded && children && (
        <div>
          {children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              expandedIds={expandedIds}
              loadingIds={loadingIds}
              childrenMap={childrenMap}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
          {children.length === 0 && (
            <p className="text-xs text-muted-foreground py-1" style={{ paddingLeft: `${20 + depth * 12}px` }}>
              Dossier vide
            </p>
          )}
        </div>
      )}
    </div>
  );
}

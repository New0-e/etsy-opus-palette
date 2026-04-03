import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DrivePanel } from "@/components/DrivePanel";
import { BottomTabs } from "@/components/BottomTabs";
import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, LogIn, ShieldAlert, Home } from "lucide-react";
import { driveStore, ALLOWED_EMAIL } from "@/lib/driveStore";

// ── PKCE helpers ───────────────────────────────────────────────────────────────

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string).trim();
const SCOPE = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "openid email profile",
].join(" ");
const VERIFIER_KEY = "drive_pkce_verifier";

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

// ── AuthGate ───────────────────────────────────────────────────────────────────

function AuthGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth callback after Google redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    if (!code || !verifier) return;

    window.history.replaceState(null, "", window.location.pathname);
    sessionStorage.removeItem(VERIFIER_KEY);
    setLoading(true);

    (async () => {
      try {
        const tokenRes = await fetch("/api/google-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirect_uri: window.location.origin,
            code_verifier: verifier,
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error);

        // Verify email
        const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }).then(r => r.json());

        if (userInfo.email !== ALLOWED_EMAIL) {
          setError(`Accès refusé — connecte-toi avec ${ALLOWED_EMAIL}`);
          return;
        }

        driveStore.setAuth(tokenData.access_token, userInfo.email);
      } catch (e) {
        setError("Connexion échouée : " + (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogin = async () => {
    const verifier = generateVerifier();
    const challenge = await generateChallenge(verifier);
    sessionStorage.setItem(VERIFIER_KEY, verifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: window.location.origin,
      response_type: "code",
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "online",
      prompt: "consent",
      login_hint: ALLOWED_EMAIL,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Vérification du compte…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-sm w-full px-8">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Accès restreint</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Ce tableau de bord est privé.<br />
            Connecte-toi avec{" "}
            <span className="text-primary font-medium">{ALLOWED_EMAIL}</span>.
          </p>
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 text-left">
            <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <Button onClick={handleLogin} className="gap-2 w-full">
          <LogIn className="h-4 w-4" />
          Se connecter avec Google
        </Button>
      </div>
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const [isAuthorized, setIsAuthorized] = useState(driveStore.isAuthorized());
  const navigate = useNavigate();

  useEffect(() => {
    return driveStore.onAuthChange(() => {
      setIsAuthorized(driveStore.isAuthorized());
    });
  }, []);

  if (!isAuthorized) {
    return <AuthGate />;
  }

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile top bar */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-border bg-background flex-shrink-0">
            <SidebarTrigger />
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Accueil</span>
            </button>
          </div>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
          <BottomTabs />
        </div>
        <DrivePanel />
      </div>
    </SidebarProvider>
  );
}

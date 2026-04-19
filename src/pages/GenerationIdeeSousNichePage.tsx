import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Lightbulb, Copy, Check, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { getPageState, setPageState } from "@/lib/pageStore";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/749aeccd-3a6d-473d-b31a-756b5d7a702f";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/749aeccd-3a6d-473d-b31a-756b5d7a702f";

const PAGE_KEY = "generation-idee-sous-niche";
type PageState = { input: string; result: string; testMode: boolean };
const defaults: PageState = { input: "", result: "", testMode: false };

// Extrait le texte depuis n'importe quel format de réponse n8n/Gemini
function extractText(raw: string): string {
  try {
    const json = JSON.parse(raw);
    const arr = Array.isArray(json) ? json : [json];
    const candidate = arr[0];
    // Format Gemini : {content: {parts: [{text: "..."}]}}
    const geminiText = candidate?.content?.parts?.[0]?.text
      ?? candidate?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (geminiText) return geminiText;
    // Format n8n structuré
    return candidate?.sous_niches ?? candidate?.text ?? candidate?.output ?? candidate?.result ?? raw;
  } catch {
    return raw;
  }
}

interface Bloc {
  label: string;
  contenu: string;
  liste?: string[];
}

interface SousNiche {
  titre: string;
  blocs: Bloc[];
}

function parseSousNiches(markdown: string): SousNiche[] {
  // Découpe sur "## N." (N = un ou plusieurs chiffres)
  const sections = markdown.split(/(?=##\s+\d+\.\s+)/).map(s => s.trim()).filter(Boolean);

  return sections.map((section) => {
    const lines = section.split("\n");
    // Titre : première ligne, on retire le préfixe "## N. "
    const titre = lines[0].replace(/^##\s+\d+\.\s+/, "").trim();
    const blocs: Bloc[] = [];
    let currentLabel = "";
    let currentLines: string[] = [];

    const flush = () => {
      if (!currentLabel) return;
      const liste = currentLines
        .filter(l => l.startsWith("- "))
        .map(l => l.replace(/^-\s*/, "").trim());
      const texte = currentLines
        .filter(l => !l.startsWith("- "))
        .join(" ")
        .trim();
      blocs.push({ label: currentLabel, contenu: texte, liste: liste.length ? liste : undefined });
      currentLines = [];
      currentLabel = "";
    };

    for (const line of lines.slice(1)) {
      // Matche **Label :** ou **Label** : (colon dedans ou dehors)
      const bold = line.match(/^\*\*([^*]+?)\s*:?\*\*\s*:?\s*(.*)/);
      if (bold) {
        flush();
        currentLabel = bold[1].trim();
        const rest = bold[2].trim();
        if (rest) currentLines.push(rest);
      } else if (line.trim()) {
        currentLines.push(line.trim());
      }
    }
    flush();
    return { titre, blocs };
  });
}

// Niveaux reconnus pour les badges (Concurrence / Rentabilité)
const LEVELS = ["Faible", "Moyen", "Moyenne", "Élevé", "Élevée", "Très élevé", "Très élevée"];
const badgeColors: Record<string, string> = {
  Faible:       "bg-green-400/10 text-green-400 border-green-400/20",
  Moyen:        "bg-amber-400/10 text-amber-400 border-amber-400/20",
  Moyenne:      "bg-amber-400/10 text-amber-400 border-amber-400/20",
  Élevé:        "bg-primary/10 text-primary border-primary/20",
  Élevée:       "bg-primary/10 text-primary border-primary/20",
  "Très élevé": "bg-primary/10 text-primary border-primary/20",
  "Très élevée":"bg-primary/10 text-primary border-primary/20",
};

function extractLevel(contenu: string): { level: string; explication: string } | null {
  for (const lvl of LEVELS) {
    if (contenu.startsWith(lvl)) {
      const after = contenu[lvl.length];
      // Vérifie que le niveau est complet (suivi d'un espace, tiret, ou fin de chaîne)
      if (after !== undefined && !/[\s—–\-]/.test(after)) continue;
      const rest = contenu.slice(lvl.length).replace(/^\s*[—–\-]\s*/, "").trim();
      return { level: lvl, explication: rest };
    }
  }
  return null;
}

const isBadgeLabel = (label: string) => {
  const l = label.toLowerCase();
  return l.includes("concurrence") || l.includes("rentabilit");
};

function SousNicheCard({ niche, index }: { niche: SousNiche; index: number }) {
  const [copied, setCopied] = useState(false);

  const raw = [
    `## ${index + 1}. ${niche.titre}`,
    ...niche.blocs.map(b => {
      const items = b.liste ? b.liste.map(i => `- ${i}`).join("\n") : "";
      return `**${b.label} :** ${b.contenu}\n${items}`.trim();
    }),
  ].join("\n\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/60 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
            {index + 1}
          </span>
          <h3 className="text-sm font-semibold">{niche.titre}</h3>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {niche.blocs.map((bloc, i) => {
          const lvl = isBadgeLabel(bloc.label) ? extractLevel(bloc.contenu) : null;
          return (
            <div key={i}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {bloc.label}
              </span>
              {lvl ? (
                <div className="mt-1 space-y-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${badgeColors[lvl.level] ?? "bg-secondary text-muted-foreground border-border"}`}>
                    {lvl.level}
                  </span>
                  {lvl.explication && (
                    <p className="text-xs text-muted-foreground">{lvl.explication}</p>
                  )}
                </div>
              ) : bloc.liste ? (
                <ul className="mt-1 space-y-0.5">
                  {bloc.liste.map((item, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-xs text-foreground">
                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-foreground">{bloc.contenu}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GenerationIdeeSousNichePage() {
  const saved = getPageState<PageState>(PAGE_KEY, defaults);
  const [input, setInputRaw] = useState(saved.input);
  const [result, setResultRaw] = useState(saved.result);
  const [loading, setLoading] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [testMode, setTestModeRaw] = useState(saved.testMode);

  const setInput = (v: string) => { setInputRaw(v); setPageState<PageState>(PAGE_KEY, { input: v }); };
  const setResult = (v: string) => { setResultRaw(v); setPageState<PageState>(PAGE_KEY, { result: v }); };
  const setTestMode = (v: boolean) => { setTestModeRaw(v); setPageState<PageState>(PAGE_KEY, { testMode: v }); };

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const url = testMode ? WEBHOOK_TEST : WEBHOOK_PROD;
      const formData = new FormData();
      formData.append("niche", input);
      const res = await fetch(url, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setResult(extractText(text));
      toast.success("Idées générées !");
    } catch {
      toast.error("Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(result);
    setCopiedAll(true);
    toast.success("Tout copié !");
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const niches = result ? parseSousNiches(result) : [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Génération idée sous niche</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>
            Mode test
          </span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>

      <div className="tool-card space-y-6">
        <div className="space-y-2">
          <Label>Décrivez votre niche</Label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex : bijoux artisanaux pour femmes minimalistes..."
            className="min-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate();
            }}
          />
          <p className="text-xs text-muted-foreground">Ctrl+Entrée pour générer</p>
        </div>

        <Button onClick={handleGenerate} disabled={!input.trim() || loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
          {loading ? "Génération en cours..." : "Générer des idées"}
        </Button>
      </div>

      {loading && (
        <div className="mt-6 flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Génération en cours...</span>
        </div>
      )}

      {!loading && niches.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {niches.length} sous-niche{niches.length > 1 ? "s" : ""} générée{niches.length > 1 ? "s" : ""}
            </span>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedAll ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedAll ? "Copié !" : "Tout copier"}
            </button>
          </div>
          {niches.map((niche, i) => (
            <SousNicheCard key={i} niche={niche} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

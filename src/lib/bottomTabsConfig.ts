import { Table2, Store, FileText } from "lucide-react";

export const BOTTOM_TABS = [
  {
    id: "prompt",
    title: "Bloc Note",
    icon: FileText,
    url: "",
    type: "doc" as const,
  },
  {
    id: "boutique",
    title: "Liste Boutique",
    icon: Store,
    url: "https://docs.google.com/spreadsheets/d/1S1LsdSWUYZwBgFtcWu8hvOo27Y7rZCcyRShl7UI-zKo/edit?gid=1536179428#gid=1536179428",
    type: "sheet" as const,
  },
  {
    id: "tableau",
    title: "Tableau Contrôle",
    icon: Table2,
    url: "https://docs.google.com/spreadsheets/d/1u3_-YtIYqCnO2YEPfLh1cCsjd2CcRiT1cKileCLA0Ig/edit?gid=0#gid=0",
    type: "sheet" as const,
  },
] as const;

export type BottomTabId = typeof BOTTOM_TABS[number]["id"];

import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const driveFolders = [
  { name: "Boutique 1", children: ["Fiches Produits", "Photos Brutes", "Photos Finales", "Mockups"] },
  { name: "Boutique 2", children: ["Fiches Produits", "Photos Brutes", "Photos Finales", "Mockups"] },
  { name: "Boutique 3", children: ["Fiches Produits", "Photos Brutes", "Photos Finales", "Mockups"] },
  { name: "Templates", children: ["Logos", "Bannières", "Descriptions"] },
  { name: "Ressources", children: ["Fonds", "Modèles", "Textures"] },
];

export function DrivePanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);

  const toggleFolder = (name: string) => {
    setExpandedFolders((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]
    );
  };

  return (
    <div className={`border-l border-border bg-drive transition-all duration-300 flex flex-col ${isOpen ? "w-64" : "w-10"}`}>
      <div className="p-2 flex items-center justify-between border-b border-border">
        {isOpen && <span className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider px-2">Drive</span>}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {isOpen && (
        <ScrollArea className="flex-1 p-2">
          {driveFolders.map((folder) => (
            <div key={folder.name} className="mb-1">
              <button
                onClick={() => toggleFolder(folder.name)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-drive-hover transition-colors"
              >
                <ChevronRight className={`h-3 w-3 transition-transform ${expandedFolders.includes(folder.name) ? "rotate-90" : ""}`} />
                {expandedFolders.includes(folder.name) ? (
                  <FolderOpen className="h-4 w-4 text-primary" />
                ) : (
                  <Folder className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{folder.name}</span>
              </button>
              {expandedFolders.includes(folder.name) && (
                <div className="ml-6 pl-2 border-l border-border">
                  {folder.children.map((child) => (
                    <button
                      key={child}
                      className="flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-drive-hover transition-colors"
                    >
                      <Folder className="h-3 w-3" />
                      <span>{child}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  );
}

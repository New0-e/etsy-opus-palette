import {
  FileText, ImageDown, Camera, Tags, BarChart3, UserSearch,
  ExternalLink, FolderOpen, Table2, Store, Package,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainTools = [
  { title: "Génération Fiches Produits", url: "/creation-fiche", icon: FileText },
  { title: "Téléchargement Images", url: "/download-images", icon: ImageDown },
  { title: "Génération Images", url: "/generation-photos", icon: Camera },
];

const secondaryTools = [
  { title: "Analyse Image → Tags", url: "/analyse-image", icon: Tags },
  { title: "Analyse Tags", url: "/analyse-tags", icon: BarChart3 },
  { title: "Tags Concurrent", url: "/tags-concurrent", icon: UserSearch },
];

const sheetLinks = [
  {
    title: "Tableau Contrôle",
    icon: Table2,
    url: "https://docs.google.com/spreadsheets/d/1u3_-YtIYqCnO2YEPfLh1cCsjd2CcRiT1cKileCLA0Ig/edit?gid=0#gid=0",
  },
  {
    title: "Liste Boutique",
    icon: Store,
    url: "https://docs.google.com/spreadsheets/d/1cetIf0cfWDxz-geTmatUOBchdjUUpCvS/edit?gid=1536179428#gid=1536179428",
  },
  {
    title: "Suivi Commande",
    icon: Package,
    url: "https://docs.google.com/spreadsheets/d/1exMlQ6dnfIGF7xsgUJskk57IRypVK29E/edit?gid=513162334#gid=513162334",
  },
  {
    title: "Prompt",
    icon: FileText,
    url: "https://docs.google.com/document/d/1h9iRZWZSMjeu8aec_cVFFl0K24oBVR1HDZqhcjWErko/edit?tab=t.0",
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

  const openSheet = (title: string, url: string) => {
    if (!url) return;
    navigate(`/viewer?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-4">
        <div className="px-4 pb-4 flex items-center gap-2">
          <SidebarTrigger />
          <NavLink to="/" className="font-display font-bold text-lg text-foreground hover:text-primary transition-colors group-data-[collapsible=icon]:hidden">
            Etsy Tools
          </NavLink>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Outils Principaux
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainTools.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Outils Secondaires
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryTools.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="p-0">
        <div className="px-3 pb-1 pt-2 border-t border-sidebar-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1 py-1.5">Raccourci Drive</p>
          <SidebarMenu>
            {sheetLinks.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  onClick={() => openSheet(item.title, item.url)}
                  disabled={!item.url}
                  className={!item.url ? "opacity-40 cursor-not-allowed" : ""}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
        <div className="p-4 pt-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-border hover:bg-secondary"
            onClick={() => window.open("https://drive.google.com", "_blank")}
          >
            <FolderOpen className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">Google Drive</span>
            <ExternalLink className="h-3 w-3 ml-auto group-data-[collapsible=icon]:hidden" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

import {
  FileText, ImageDown, Camera, Tags, BarChart3, UserSearch,
  ExternalLink, FolderOpen, FileImage, PersonStanding, Layers, ClipboardList,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainTools = [
  { title: "Gen Fiches Produits", url: "/creation-fiche", icon: FileText },
  { title: "Téléchargement Images", url: "/download-images", icon: ImageDown },
  { title: "Gen Images", url: "/generation-photos", icon: Camera },
];

const secondaryTools = [
  { title: "Modèle", url: "/generation-modele", icon: PersonStanding },
  { title: "Analyse Image", url: "/analyse-image", icon: Tags },
  { title: "Analyse Tags", url: "/analyse-tags", icon: BarChart3 },
  { title: "Tags Concurrent", url: "/tags-concurrent", icon: UserSearch },
  { title: "Descriptif Image", url: "/descriptif-image", icon: FileImage },
  { title: "Idées sous Niche", url: "/generation-idee-sous-niche", icon: Layers },
];

export function AppSidebar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { setOpenMobile } = useSidebar();
  const closeOnMobile = () => setOpenMobile(false);

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
                  <SidebarMenuButton asChild isActive={isActive(item.url)} onClick={closeOnMobile}>
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
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryTools.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} onClick={closeOnMobile}>
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
        <div className="p-4 pt-2 border-t border-sidebar-border space-y-1.5">
          <SidebarMenuButton asChild isActive={isActive("/suivi-commandes")} onClick={closeOnMobile}>
            <NavLink to="/suivi-commandes" end activeClassName="bg-sidebar-accent text-primary font-medium">
              <ClipboardList className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Suivi (TEST)</span>
            </NavLink>
          </SidebarMenuButton>
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

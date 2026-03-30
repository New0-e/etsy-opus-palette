import {
  FileText, ImageDown, Camera, Tags, BarChart3, UserSearch,
  ExternalLink, FolderOpen
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainTools = [
  { title: "Création Fiche", url: "/creation-fiche", icon: FileText },
  { title: "Téléchargement Images", url: "/download-images", icon: ImageDown },
  { title: "Génération Images", url: "/generation-photos", icon: Camera },
];

const secondaryTools = [
  { title: "Analyse Image → Tags", url: "/analyse-image", icon: Tags },
  { title: "Analyse Tags", url: "/analyse-tags", icon: BarChart3 },
  { title: "Tags Concurrent", url: "/tags-concurrent", icon: UserSearch },
];

export function AppSidebar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-4">
        <div className="px-4 pb-4 flex items-center gap-2">
          <SidebarTrigger />
          <span className="font-display font-bold text-lg text-foreground group-data-[collapsible=icon]:hidden">
            Etsy Tools
          </span>
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

      <SidebarFooter className="p-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-border hover:bg-secondary"
          onClick={() => window.open("https://drive.google.com", "_blank")}
        >
          <FolderOpen className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Google Drive</span>
          <ExternalLink className="h-3 w-3 ml-auto group-data-[collapsible=icon]:hidden" />
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

import {
  FileText, ImageDown, Camera, Tags, BarChart3, UserSearch,
  ExternalLink, FolderOpen, FileImage, PersonStanding, Layers, ClipboardList, Smile,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useMemo } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import frKeywords from "@/data/emoji-fr-keywords.json";
import { toast } from "sonner";
import { BOTTOM_TABS, type BottomTabId } from "@/lib/bottomTabsConfig";

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

type Props = {
  onOpenTab: (id: BottomTabId) => void;
  activeTabId: BottomTabId | null;
};

export function AppSidebar({ onOpenTab, activeTabId }: Props) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { setOpenMobile } = useSidebar();
  const closeOnMobile = () => setOpenMobile(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const dataWithFr = useMemo(() => {
    const frMap = frKeywords as Record<string, string[]>;
    const emojis = { ...(data as { emojis: Record<string, { keywords: string[]; skins: { native: string }[] }> }).emojis };
    for (const [id, emoji] of Object.entries(emojis)) {
      const native = emoji.skins?.[0]?.native;
      if (native && frMap[native]) {
        emojis[id] = { ...emoji, keywords: [...emoji.keywords, ...frMap[native]] };
      }
    }
    return { ...(data as object), emojis };
  }, []);

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
          {BOTTOM_TABS.map(tab => (
            <SidebarMenuButton
              key={tab.id}
              isActive={activeTabId === tab.id}
              onClick={() => { onOpenTab(tab.id); closeOnMobile(); }}
              className="w-full"
            >
              <tab.icon className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">{tab.title}</span>
            </SidebarMenuButton>
          ))}
          <SidebarMenuButton asChild isActive={isActive("/suivi-commandes")} onClick={closeOnMobile}>
            <NavLink to="/suivi-commandes" end activeClassName="bg-sidebar-accent text-primary font-medium">
              <ClipboardList className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Suivi Commande</span>
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
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2 border-border hover:bg-secondary">
                <Smile className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Emojis</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="p-0 border-0 bg-transparent shadow-none w-auto">
              <Picker
                data={dataWithFr}
                locale="fr"
                theme="auto"
                onEmojiSelect={(emoji: { native: string }) => {
                  navigator.clipboard.writeText(emoji.native);
                  toast.success(`${emoji.native} copié !`);
                  setEmojiOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import HomePage from "@/pages/HomePage";
import CreationFichePage from "@/pages/CreationFichePage";
import DownloadImagesPage from "@/pages/DownloadImagesPage";
import GenerationPhotosPage from "@/pages/GenerationPhotosPage";
import GenerationModelePage from "@/pages/GenerationModelePage";
import AnalyseImagePage from "@/pages/AnalyseImagePage";
import AnalyseTagsPage from "@/pages/AnalyseTagsPage";
import TagsConcurrentPage from "@/pages/TagsConcurrentPage";
import DescriptifImagePage from "@/pages/DescriptifImagePage";
import GenerationIdeeSousNichePage from "@/pages/GenerationIdeeSousNichePage";
import ViewerPage from "@/pages/ViewerPage";
import SuiviCommandesPage from "@/pages/SuiviCommandesPage";
import FondProduitPage from "@/pages/FondProduitPage";
import NotFound from "@/pages/NotFound";
import { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode; page?: boolean }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      if (this.props.page) {
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
            <p className="text-destructive font-medium text-sm">Cette page a planté</p>
            <p className="text-xs text-muted-foreground font-mono max-w-xs text-center">{(this.state.error as Error).message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-xs text-primary underline"
            >Réessayer</button>
          </div>
        );
      }
      return (
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 px-8 max-w-sm">
            <p className="text-destructive font-medium">Une erreur est survenue</p>
            <p className="text-xs text-muted-foreground font-mono">{(this.state.error as Error).message}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-primary underline"
            >Recharger la page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary page>{children}</ErrorBoundary>;
}

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<PageBoundary><HomePage /></PageBoundary>} />
            <Route path="/creation-fiche" element={<PageBoundary><CreationFichePage /></PageBoundary>} />
            <Route path="/download-images" element={<PageBoundary><DownloadImagesPage /></PageBoundary>} />
            <Route path="/generation-photos" element={<PageBoundary><GenerationPhotosPage /></PageBoundary>} />
            <Route path="/generation-modele" element={<PageBoundary><GenerationModelePage /></PageBoundary>} />
            <Route path="/analyse-image" element={<PageBoundary><AnalyseImagePage /></PageBoundary>} />
            <Route path="/analyse-tags" element={<PageBoundary><AnalyseTagsPage /></PageBoundary>} />
            <Route path="/tags-concurrent" element={<PageBoundary><TagsConcurrentPage /></PageBoundary>} />
            <Route path="/descriptif-image" element={<PageBoundary><DescriptifImagePage /></PageBoundary>} />
            <Route path="/generation-idee-sous-niche" element={<PageBoundary><GenerationIdeeSousNichePage /></PageBoundary>} />
            <Route path="/viewer" element={<PageBoundary><ViewerPage /></PageBoundary>} />
            <Route path="/suivi-commandes" element={<PageBoundary><SuiviCommandesPage /></PageBoundary>} />
            <Route path="/fond-produit" element={<PageBoundary><FondProduitPage /></PageBoundary>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

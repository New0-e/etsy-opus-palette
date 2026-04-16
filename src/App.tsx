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
import ViewerPage from "@/pages/ViewerPage";
import NotFound from "@/pages/NotFound";
import { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
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
            <Route path="/" element={<HomePage />} />
            <Route path="/creation-fiche" element={<CreationFichePage />} />
            <Route path="/download-images" element={<DownloadImagesPage />} />
            <Route path="/generation-photos" element={<GenerationPhotosPage />} />
            <Route path="/generation-modele" element={<GenerationModelePage />} />
            <Route path="/analyse-image" element={<AnalyseImagePage />} />
            <Route path="/analyse-tags" element={<AnalyseTagsPage />} />
            <Route path="/tags-concurrent" element={<TagsConcurrentPage />} />
            <Route path="/descriptif-image" element={<DescriptifImagePage />} />
            <Route path="/viewer" element={<ViewerPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

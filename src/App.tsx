import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleOAuthProvider } from "@react-oauth/google";
import DashboardLayout from "@/components/DashboardLayout";
import HomePage from "@/pages/HomePage";
import CreationFichePage from "@/pages/CreationFichePage";
import DownloadImagesPage from "@/pages/DownloadImagesPage";
import GenerationPhotosPage from "@/pages/GenerationPhotosPage";
import AnalyseImagePage from "@/pages/AnalyseImagePage";
import AnalyseTagsPage from "@/pages/AnalyseTagsPage";
import TagsConcurrentPage from "@/pages/TagsConcurrentPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
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
            <Route path="/analyse-image" element={<AnalyseImagePage />} />
            <Route path="/analyse-tags" element={<AnalyseTagsPage />} />
            <Route path="/tags-concurrent" element={<TagsConcurrentPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import TopPage from "./pages/TopPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CanvasPage from "./pages/CanvasPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SemanticExporterPage from "./pages/SemanticExporterPage";
import FigmaImportPage from "./pages/FigmaImportPage";
import DnaLibraryPage from "./pages/DnaLibraryPage";
import SettingsPage from "./pages/SettingsPage";
import FigmaGuidePage from "./pages/FigmaGuidePage";
import PartsPage from "./pages/PartsPage";
import CodeLibraryPage from "./pages/CodeLibraryPage";
import CompositionWizardPage from "./pages/CompositionWizardPage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F0C878]">
        <p className="text-[#8B6914] text-sm tracking-widest animate-pulse">Loading...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TopPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/canvas"
        element={
          <ProtectedRoute>
            <CanvasPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/export"
        element={
          <ProtectedRoute>
            <SemanticExporterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/figma-import"
        element={
          <ProtectedRoute>
            <FigmaImportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <DnaLibraryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/figma-guide"
        element={
          <ProtectedRoute>
            <FigmaGuidePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parts"
        element={
          <ProtectedRoute>
            <PartsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/code-library"
        element={
          <ProtectedRoute>
            <CodeLibraryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/compose"
        element={
          <ProtectedRoute>
            <CompositionWizardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

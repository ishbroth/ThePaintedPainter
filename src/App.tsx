import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, ProtectedRoute } from './lib/auth/index.ts';
import { ThemeProvider } from './lib/theme/index.ts';
import Header from './components/Header';
import ThemeToggle from './components/ThemeToggle';
import HouseWatermark from './components/HouseWatermark';
import { ThemeAccountSync } from './components/ThemeAccountSync';
import AuthRedirectBanner from './components/AuthRedirectBanner';
import Footer from './components/Footer';
import Home from './pages/Home';
import QuoteResults from './pages/QuoteResults';
import Services from './pages/Services';
import Gallery from './pages/Gallery';
import PaintersMap from './pages/PaintersMap';
import PainterSignup from './pages/PainterSignup';
import Support from './pages/Support';
import PainterPublicProfile from './pages/PainterPublicProfile';
import ConfirmJob from './pages/ConfirmJob';
import LeaveReview from './pages/LeaveReview';
import PainterConfirmDate from './pages/painter/PainterConfirmDate.tsx';
import PainterReview from './pages/admin/PainterReview.tsx';
import PainterConfirmSignup from './pages/painter/PainterConfirmSignup.tsx';
import AcceptJob from './pages/painter/AcceptJob.tsx';
import ForgotPassword from './pages/auth/ForgotPassword.tsx';
import ResetPassword from './pages/auth/ResetPassword.tsx';
import SignIn from './pages/auth/SignIn';
import CustomerSignUp from './pages/auth/CustomerSignUp';
import PainterSignUp from './pages/auth/PainterSignUp';
import DashboardLayout from './components/ui/DashboardLayout.tsx';
import PainterDashboard from './pages/painter/PainterDashboard.tsx';
import PainterProfile from './pages/painter/PainterProfile.tsx';
import PainterPortfolio from './pages/painter/PainterPortfolio.tsx';
import PainterProjects from './pages/painter/PainterProjects.tsx';
import PainterReviews from './pages/painter/PainterReviews.tsx';
import PainterSettings from './pages/painter/PainterSettings.tsx';
import PainterNotifications from './pages/painter/PainterNotifications.tsx';
import CustomerDashboard from './pages/customer/CustomerDashboard.tsx';
import CustomerProfile from './pages/customer/CustomerProfile.tsx';
import CustomerProjects from './pages/customer/CustomerProjects.tsx';
import CustomerNotifications from './pages/customer/CustomerNotifications.tsx';
import type { SidebarItem } from './components/ui/DashboardSidebar.tsx';
import './index.css';

const queryClient = new QueryClient();

// ---------------------------------------------------------------------------
// Painter dashboard sidebar items
// ---------------------------------------------------------------------------
const painterSidebarItems: SidebarItem[] = [
  { label: 'Dashboard', icon: '\u{1F3E0}', path: '/painter/dashboard' },
  { label: 'Profile', icon: '\u{1F464}', path: '/painter/dashboard/profile' },
  { label: 'Portfolio', icon: '\u{1F5BC}', path: '/painter/dashboard/portfolio' },
  { label: 'My Projects', icon: '\u{1F4CB}', path: '/painter/dashboard/projects' },
  { label: 'Reviews', icon: '\u2B50', path: '/painter/dashboard/reviews' },
  { label: 'Settings', icon: '\u2699', path: '/painter/dashboard/settings' },
  { label: 'Notifications', icon: '\u{1F514}', path: '/painter/dashboard/notifications' },
];

function PainterDashboardLayout() {
  return (
    <DashboardLayout items={painterSidebarItems} title="Painter Dashboard" />
  );
}

// ---------------------------------------------------------------------------
// Customer dashboard sidebar items
// ---------------------------------------------------------------------------
const customerSidebarItems: SidebarItem[] = [
  { label: 'Dashboard', icon: '\u{1F3E0}', path: '/customer/dashboard' },
  { label: 'My Projects', icon: '\u{1F4CB}', path: '/customer/dashboard/projects' },
  { label: 'Profile', icon: '\u{1F464}', path: '/customer/dashboard/profile' },
  { label: 'Notifications', icon: '\u{1F514}', path: '/customer/dashboard/notifications' },
];

function CustomerDashboardLayout() {
  return (
    <DashboardLayout items={customerSidebarItems} title="Customer Dashboard" />
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <Router>
        <AuthProvider>
          <ThemeAccountSync />
          <HouseWatermark />
          <div className="min-h-screen flex flex-col" style={{ position: 'relative', zIndex: 1 }}>
            <Header />
            <ThemeToggle />
            <AuthRedirectBanner />
            <main className="flex-grow">
              <Routes>
                {/* Existing routes */}
                <Route path="/" element={<Home />} />
                <Route path="/quote-results" element={<QuoteResults />} />
                <Route path="/about" element={<Navigate to="/support" replace />} />
                <Route path="/services" element={<Services />} />
                <Route path="/quote" element={<Navigate to="/" replace />} />
                <Route path="/contact" element={<Navigate to="/" replace />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/painters-map" element={<PaintersMap />} />
                <Route path="/painter-signup" element={<PainterSignup />} />

                {/* New public routes */}
                <Route path="/support" element={<Support />} />
                <Route path="/painters/:id" element={<PainterPublicProfile />} />
                <Route path="/confirm-job" element={<ConfirmJob />} />
                <Route path="/leave-review" element={<LeaveReview />} />
                <Route path="/painter/confirm-date" element={<PainterConfirmDate />} />
                <Route path="/admin/painter-review" element={<PainterReview />} />
                <Route path="/painter/confirm-signup" element={<PainterConfirmSignup />} />
                <Route path="/painter/accept-job" element={<AcceptJob />} />

                {/* Auth routes */}
                <Route path="/auth/sign-in" element={<SignIn />} />
                {/* Old per-role sign-in URLs (bookmarks, old emails) land on the single sign-in. */}
                <Route path="/auth/painter-sign-in" element={<Navigate to="/auth/sign-in" replace />} />
                <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
                <Route path="/auth/painter-sign-up" element={<PainterSignUp />} />
                <Route path="/auth/customer-sign-in" element={<Navigate to="/auth/sign-in" replace />} />
                <Route path="/auth/customer-sign-up" element={<CustomerSignUp />} />

                {/* Painter dashboard (protected) */}
                <Route
                  path="/painter/dashboard"
                  element={
                    <ProtectedRoute requiredRole="painter">
                      <PainterDashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<PainterDashboard />} />
                  <Route path="profile" element={<PainterProfile />} />
                  <Route path="portfolio" element={<PainterPortfolio />} />
                  <Route path="projects" element={<PainterProjects />} />
                  <Route path="reviews" element={<PainterReviews />} />
                  <Route path="settings" element={<PainterSettings />} />
                  <Route path="notifications" element={<PainterNotifications />} />
                </Route>

                {/* Customer dashboard (protected) */}
                <Route
                  path="/customer/dashboard"
                  element={
                    <ProtectedRoute requiredRole="customer">
                      <CustomerDashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<CustomerDashboard />} />
                  <Route path="profile" element={<CustomerProfile />} />
                  <Route path="projects" element={<CustomerProjects />} />
                  <Route path="notifications" element={<CustomerNotifications />} />
                </Route>
              </Routes>
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

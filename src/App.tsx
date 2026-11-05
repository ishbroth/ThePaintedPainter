import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { onAppUrl, routeFromUrl } from './lib/native.ts';
import Privacy from './pages/Privacy.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, ProtectedRoute } from './lib/auth/index.ts';
import { ThemeProvider } from './lib/theme/index.ts';
import Header from './components/Header';
import ThemeToggle from './components/ThemeToggle';
import SiteBackground from './components/SiteBackground';
import { ThemeAccountSync } from './components/ThemeAccountSync';
import VoiceCheck from './components/VoiceCheck';
import AuthRedirectBanner from './components/AuthRedirectBanner';
import FaceIdPrompt from './components/FaceIdPrompt';
import Footer from './components/Footer';
import Home from './pages/Home';
import QuoteResults from './pages/QuoteResults';
import NotForPainters from './components/NotForPainters.tsx';
import Services from './pages/Services';
import Gallery from './pages/Gallery';
import PaintersMap from './pages/PaintersMap';
import PainterSignup from './pages/PainterSignup';
import Support from './pages/Support';
import PainterPublicProfile from './pages/PainterPublicProfile';
import ConfirmJob from './pages/ConfirmJob';
import LeaveReview from './pages/LeaveReview';
import PainterAvailability from './pages/painter/PainterAvailability.tsx';
import ChoosePainter from './pages/ChoosePainter.tsx';
import CancelRequest from './pages/CancelRequest.tsx';
import CancelClaim from './pages/CancelClaim.tsx';
import ResumeSearch from './pages/ResumeSearch.tsx';
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
import PainterReviews from './pages/painter/PainterReviews.tsx';
import PainterSettings from './pages/painter/PainterSettings.tsx';
import PainterNotifications from './pages/painter/PainterNotifications.tsx';
import PainterBusiness from './pages/painter/PainterBusiness.tsx';
import PainterRewards from './pages/painter/PainterRewards.tsx';
import PainterContract from './pages/painter/PainterContract.tsx';
import CustomerContract from './pages/customer/CustomerContract.tsx';
import CustomerDashboard from './pages/customer/CustomerDashboard.tsx';
import CustomerNotifications from './pages/customer/CustomerNotifications.tsx';
import './index.css';

const queryClient = new QueryClient();

/** A redirect that keeps the query string and hash, so an old address with ?messages=<job> still opens that thread on the merged dashboard. */
function RedirectTo({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}

/** In the iOS / Android app, a link that opens the app (an emailed link on the site) goes to the matching page inside it. */
function NativeLinks() {
  const navigate = useNavigate();
  useEffect(() => onAppUrl((url) => { const path = routeFromUrl(url); if (path) navigate(path); }), [navigate]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <Router>
        <AuthProvider>
          <ThemeAccountSync />
          <NativeLinks />
          <FaceIdPrompt />
          <SiteBackground />
          <VoiceCheck />
          <div className="min-h-screen flex flex-col" style={{ position: 'relative', zIndex: 1 }}>
            <ThemeToggle />
            <Header />
            <AuthRedirectBanner />
            <main className="flex-grow">
              <Routes>
                {/* Existing routes */}
                <Route path="/" element={<Home />} />
                <Route path="/quote-results" element={<NotForPainters><QuoteResults /></NotForPainters>} />
                <Route path="/about" element={<Navigate to="/support" replace />} />
                <Route path="/services" element={<Services />} />
                <Route path="/quote" element={<Navigate to="/" replace />} />
                <Route path="/contact" element={<Navigate to="/" replace />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/painters-map" element={<PaintersMap />} />
                <Route path="/painter-signup" element={<PainterSignup />} />

                {/* New public routes */}
                <Route path="/support" element={<Support />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/painters/:id" element={<PainterPublicProfile />} />
                <Route path="/confirm-job" element={<ConfirmJob />} />
                <Route path="/leave-review" element={<LeaveReview />} />
                <Route path="/painter/availability" element={<PainterAvailability />} />
                <Route path="/painter/confirm-date" element={<RedirectTo to="/painter/dashboard" />} />
                <Route path="/choose-painter" element={<NotForPainters><ChoosePainter /></NotForPainters>} />
                <Route path="/cancel-request" element={<CancelRequest />} />
                <Route path="/cancel-claim" element={<CancelClaim />} />
                <Route path="/resume-search" element={<NotForPainters><ResumeSearch /></NotForPainters>} />
                <Route path="/admin/painter-review" element={<PainterReview />} />
                <Route path="/painter/confirm-signup" element={<PainterConfirmSignup />} />
                <Route path="/painter/accept-job" element={<AcceptJob />} />
                {/* Short links used in emails and push notifications. */}
                <Route path="/customer/projects" element={<RedirectTo to="/customer/dashboard" />} />
                <Route path="/painter/projects" element={<RedirectTo to="/painter/dashboard" />} />

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
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<PainterDashboard />} />
                  <Route path="profile" element={<PainterProfile />} />
                  <Route path="portfolio" element={<PainterPortfolio />} />
                  {/* My Projects was merged into the Dashboard; the old address (emails, notifications) goes there */}
                  <Route path="projects" element={<RedirectTo to="/painter/dashboard" />} />
                  <Route path="contract/:jobId" element={<PainterContract />} />
                  <Route path="business" element={<PainterBusiness />} />
                  <Route path="reviews" element={<PainterReviews />} />
                  <Route path="rewards" element={<PainterRewards />} />
                  <Route path="settings" element={<PainterSettings />} />
                  <Route path="notifications" element={<PainterNotifications />} />
                </Route>

                {/* Customer dashboard (protected) */}
                <Route
                  path="/customer/dashboard"
                  element={
                    <ProtectedRoute requiredRole="customer">
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<CustomerDashboard />} />
                  {/* Profile and My Projects were merged into the Dashboard; the old addresses go there */}
                  <Route path="profile" element={<RedirectTo to="/customer/dashboard" />} />
                  <Route path="projects" element={<RedirectTo to="/customer/dashboard" />} />
                  <Route path="contract/:jobId" element={<CustomerContract />} />
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

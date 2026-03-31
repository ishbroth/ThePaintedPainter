import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, ProtectedRoute } from './lib/auth/index.ts';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import Gallery from './pages/Gallery';
import Contact from './pages/Contact';
import PaintersMap from './pages/PaintersMap';
import PainterSignup from './pages/PainterSignup';
import Support from './pages/Support';
import PainterPublicProfile from './pages/PainterPublicProfile';
import CustomerSignIn from './pages/auth/CustomerSignIn';
import CustomerSignUp from './pages/auth/CustomerSignUp';
import PainterSignIn from './pages/auth/PainterSignIn';
import PainterSignUp from './pages/auth/PainterSignUp';
import DashboardLayout from './components/ui/DashboardLayout.tsx';
import PainterDashboard from './pages/painter/PainterDashboard.tsx';
import PainterProfile from './pages/painter/PainterProfile.tsx';
import PainterPortfolio from './pages/painter/PainterPortfolio.tsx';
import PainterDeals from './pages/painter/PainterDeals.tsx';
import PainterOffers from './pages/painter/PainterOffers.tsx';
import PainterJobs from './pages/painter/PainterJobs.tsx';
import PainterReviews from './pages/painter/PainterReviews.tsx';
import PainterSettings from './pages/painter/PainterSettings.tsx';
import PainterNotifications from './pages/painter/PainterNotifications.tsx';
import CustomerDashboard from './pages/customer/CustomerDashboard.tsx';
import CustomerProfile from './pages/customer/CustomerProfile.tsx';
import CustomerProjects from './pages/customer/CustomerProjects.tsx';
import CustomerNotifications from './pages/customer/CustomerNotifications.tsx';
import CustomerReviewForm from './pages/customer/CustomerReviewForm.tsx';
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
  { label: 'Deals', icon: '\u{1F3F7}', path: '/painter/dashboard/deals' },
  { label: 'Job Offers', icon: '\u{1F4E9}', path: '/painter/dashboard/offers' },
  { label: 'My Jobs', icon: '\u{1F528}', path: '/painter/dashboard/jobs' },
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
      <Router>
        <AuthProvider>
          <div className="min-h-screen flex flex-col bg-[#1a1a1a]">
            <Header />
            <main className="flex-grow">
              <Routes>
                {/* Existing routes */}
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/services" element={<Services />} />
                <Route path="/quote" element={<Navigate to="/contact" replace />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/painters-map" element={<PaintersMap />} />
                <Route path="/painter-signup" element={<PainterSignup />} />

                {/* New public routes */}
                <Route path="/support" element={<Support />} />
                <Route path="/painters/:id" element={<PainterPublicProfile />} />

                {/* Auth routes */}
                <Route path="/auth/painter-sign-in" element={<PainterSignIn />} />
                <Route path="/auth/painter-sign-up" element={<PainterSignUp />} />
                <Route path="/auth/customer-sign-in" element={<CustomerSignIn />} />
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
                  <Route path="deals" element={<PainterDeals />} />
                  <Route path="offers" element={<PainterOffers />} />
                  <Route path="jobs" element={<PainterJobs />} />
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
                  <Route path="review/:painterId" element={<CustomerReviewForm />} />
                </Route>
              </Routes>
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;

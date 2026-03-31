import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
import './index.css';

const queryClient = new QueryClient();

// ---------------------------------------------------------------------------
// Placeholder pages (to be replaced with real implementations)
// ---------------------------------------------------------------------------
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
    </div>
  );
}

function PainterPublicProfile() { return <Placeholder title="Painter Profile" />; }
function PainterSignIn() { return <Placeholder title="Painter Sign In" />; }
function PainterSignUp() { return <Placeholder title="Painter Sign Up" />; }
function CustomerSignIn() { return <Placeholder title="Customer Sign In" />; }
function CustomerSignUp() { return <Placeholder title="Customer Sign Up" />; }

// Dashboard layouts
function PainterDashboardLayout() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Outlet />
    </div>
  );
}

function CustomerDashboardLayout() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Outlet />
    </div>
  );
}

// Painter dashboard child placeholders
function PainterDashboard() { return <Placeholder title="Painter Dashboard" />; }
function PainterProfile() { return <Placeholder title="Painter Profile Settings" />; }
function PainterPortfolio() { return <Placeholder title="Painter Portfolio" />; }
function PainterDeals() { return <Placeholder title="Painter Deals" />; }
function PainterOffers() { return <Placeholder title="Painter Offers" />; }
function PainterJobs() { return <Placeholder title="Painter Jobs" />; }
function PainterReviews() { return <Placeholder title="Painter Reviews" />; }
function PainterSettings() { return <Placeholder title="Painter Settings" />; }
function PainterNotifications() { return <Placeholder title="Painter Notifications" />; }

// Customer dashboard child placeholders
function CustomerDashboard() { return <Placeholder title="Customer Dashboard" />; }
function CustomerProfile() { return <Placeholder title="Customer Profile" />; }
function CustomerProjects() { return <Placeholder title="Customer Projects" />; }
function CustomerNotifications() { return <Placeholder title="Customer Notifications" />; }

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

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Navbar from './components/Navbar';
import AdminLayout from './components/AdminLayout';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AddressesPage from './pages/AddressesPage';
import OrdersPage from './pages/OrdersPage';
import ProfilePage from './pages/ProfilePage';
import OffersPage from './pages/OffersPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOffers from './pages/admin/AdminOffers';
import AdminLocations from './pages/admin/AdminLocations';
import AdminUsers from './pages/admin/AdminUsers';
import { AdminPermissionKey, profileHasPermission } from './lib/types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-200 rounded-xl" />
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children, permission }: { children: React.ReactNode; permission?: AdminPermissionKey }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-200 rounded-xl" />
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.is_admin || profile.is_active === false) return <Navigate to="/home" replace />;
  if (permission && !profileHasPermission(profile, permission)) {
    const fallback = (['dashboard', 'orders', 'products', 'offers', 'locations', 'users'] as AdminPermissionKey[])
      .find((key) => profileHasPermission(profile, key));
    const fallbackPath = fallback === 'dashboard' ? '/admin' : fallback ? `/admin/${fallback}` : '/home';
    return <Navigate to={fallbackPath} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-200 rounded-xl" />
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const currentPath = window.location.hash.replace(/^#/, '') || window.location.pathname;
  const isAdminRoute = currentPath.startsWith('/admin');

  return (
    <>
      {user && !isAdminRoute && <Navbar />}
      <Routes>
        <Route path="/register" element={user ? <Navigate to="/home" replace /> : <RegisterPage />} />
        <Route path="/login" element={user ? <Navigate to="/home" replace /> : <LoginPage />} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
        <Route path="/product/:id" element={<ProtectedRoute><ProductDetailPage /></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/addresses" element={<ProtectedRoute><AddressesPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/offers" element={<ProtectedRoute><OffersPage /></ProtectedRoute>} />
        {/* Admin routes */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminRoute permission="dashboard"><AdminDashboard /></AdminRoute>} />
          <Route path="orders" element={<AdminRoute permission="orders"><AdminOrders /></AdminRoute>} />
          <Route path="products" element={<AdminRoute permission="products"><AdminProducts /></AdminRoute>} />
          <Route path="offers" element={<AdminRoute permission="offers"><AdminOffers /></AdminRoute>} />
          <Route path="locations" element={<AdminRoute permission="locations"><AdminLocations /></AdminRoute>} />
          <Route path="users" element={<AdminRoute permission="users"><AdminUsers /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/home' : '/login'} replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </HashRouter>
  );
}

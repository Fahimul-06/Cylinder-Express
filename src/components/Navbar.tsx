import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, User, LogOut, MapPin, Package,
  Menu, X, ClipboardList, Sparkles, Shield
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageToggle from './LanguageToggle';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLanguage();

  if (!user || profile?.role === 'delivery') return null;

  const navItems = [
    { path: '/home', label: t('nav.home'), icon: Package, badge: 0 },
    { path: '/offers', label: t('nav.offers'), icon: Sparkles, badge: 0 },
    { path: '/products', label: t('nav.products'), icon: Package, badge: 0 },
    { path: '/cart', label: t('nav.cart'), icon: ShoppingCart, badge: totalItems },
    { path: '/orders', label: t('nav.orders'), icon: ClipboardList, badge: 0 },
    { path: '/addresses', label: t('nav.addresses'), icon: MapPin, badge: 0 },
    ...(profile?.is_admin ? [{ path: '/admin', label: t('nav.admin'), icon: Shield, badge: 0 }] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/home')}
            >
              <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="h-10 w-10 object-contain" />
              <span className="font-bold text-lg text-gray-900">Cylinder<span className="text-blue-600">Express</span></span>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map(({ path, label, icon: Icon, badge }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(path)
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {badge > 0 && (
                    <span className="ml-1 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <LanguageToggle />
              <NotificationBell compact />
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{profile?.full_name}</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <button
              className="md:hidden p-2 text-gray-600"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navItems.map(({ path, label, icon: Icon, badge }) => (
                <button
                  key={path}
                  onClick={() => { navigate(path); setMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive(path)
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                  {badge > 0 && (
                    <span className="ml-auto bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="px-4 flex items-center gap-2"><LanguageToggle compact /><NotificationBell compact /></div>
                <button
                  onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">{profile?.full_name}</span>
                </button>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                >
                  <LogOut className="w-5 h-5" />
                  {t('nav.signOut')}
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <div className="h-16" />
    </>
  );
}

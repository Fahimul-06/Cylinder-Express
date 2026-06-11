import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, ShoppingBag, Package, Tag, ArrowLeft,
  ChevronRight, MapPin
} from 'lucide-react';

const links = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/offers', label: 'Offers', icon: Tag },
  { path: '/admin/locations', label: 'Live Locations', icon: MapPin },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 fixed inset-y-0 left-0 z-40">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="w-9 h-9 object-contain" />
            <div>
              <span className="font-bold text-gray-900 text-sm">Cylinder<span className="text-blue-600">Express</span></span>
              <p className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {links.map(({ path, label, icon: Icon, end }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(path, end)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              {label}
              {isActive(path, end) && <ChevronRight className="w-4 h-4 ml-auto text-blue-400" />}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-gray-400 font-medium">{profile?.full_name}</p>
            <p className="text-[10px] text-blue-600 font-semibold">ADMIN</p>
          </div>
          <button
            onClick={() => navigate('/home')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Store
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="w-8 h-8 object-contain" />
            <span className="font-bold text-sm text-gray-900">Admin</span>
          </div>
          <button
            onClick={() => navigate('/home')}
            className="text-sm text-gray-500 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Store
          </button>
        </div>
        <div className="flex px-2 pb-2 gap-1 overflow-x-auto">
          {links.map(({ path, label, icon: Icon, end }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive(path, end)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-64">
        <div className="pt-[6.5rem] lg:pt-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

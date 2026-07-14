import { useNavigate } from 'react-router-dom';
import { UserRound, Flame, ChevronRight, Settings, ShoppingBag, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const items = [
    {
      title: 'My Profile',
      description: 'View and update your personal information, photo and password.',
      icon: UserRound,
      path: '/profile/details',
      iconClass: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Cylinder Usage',
      description: 'Check estimated gas remaining and your predicted next order date.',
      icon: Flame,
      path: '/cylinder-usage',
      iconClass: 'bg-orange-100 text-orange-600',
    },
    {
      title: 'My Orders',
      description: 'View product orders, service bookings and delivery progress.',
      icon: ShoppingBag,
      path: '/orders',
      iconClass: 'bg-violet-100 text-violet-600',
    },
    {
      title: 'Delivery Addresses',
      description: 'Add, edit and manage your saved delivery addresses.',
      icon: MapPin,
      path: '/addresses',
      iconClass: 'bg-emerald-100 text-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Settings className="w-5 h-5" />
            <span className="text-sm font-medium">Account</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Hello {profile?.full_name || 'Customer'}, choose a section to continue.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {items.map(({ title, description, icon: Icon, path, iconClass }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="group text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-blue-100 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${iconClass}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-gray-900">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

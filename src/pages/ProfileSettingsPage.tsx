import { ChevronRight, Lock, Settings, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfileSettingsPage() {
  const navigate = useNavigate();

  const items = [
    {
      title: 'Profile',
      description: 'View and update your personal information and cylinder usage.',
      icon: UserRound,
      iconClass: 'bg-blue-50 text-blue-600',
      path: '/profile',
    },
    {
      title: 'Change Password',
      description: 'Securely update your account password using OTP verification.',
      icon: Lock,
      iconClass: 'bg-amber-50 text-amber-600',
      path: '/change-password',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Profile Settings</h1>
            <p className="text-sm text-gray-500">Manage your profile and account security.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {items.map(({ title, description, icon: Icon, iconClass, path }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="group bg-white border border-gray-100 rounded-2xl p-5 text-left shadow-sm hover:shadow-md hover:border-blue-100 transition-all"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconClass}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-900">{title}</h2>
                  <p className="mt-1 text-sm leading-5 text-gray-500">{description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  LogOut,
  User,
  Code2,
  Briefcase,
  Clock,
  Mail,
  Home,
  Menu,
  X,
  ChevronRight,
  MessageSquare,
  MessageCircle,
  Award,
  PhoneCall,
  UsersRound,
  Images,
  GraduationCap,
  MapPinned,
} from 'lucide-react';
import { AboutManager } from './AboutManager';
import { SkillsManager } from './SkillsManager';
import { ProjectsManager } from './ProjectsManager';
import { ExperienceManager } from './ExperienceManager';
import { ContactManager } from './ContactManager';
import { MessagesManager } from './MessagesManager';
import { CertificatesManager } from './CertificatesManager';
import { LiveCallManager } from './LiveCallManager';
import { AdminGlobalCallRinger } from './AdminGlobalCallRinger';
import { VisitorsManager } from './VisitorsManager';
import { HeroMediaManager } from './HeroMediaManager';
import { AdminChatManager } from './AdminChatManager';
import { EducationManager } from './EducationManager';
import { ProjectCommentsManager } from './ProjectCommentsManager';
import { DeliveryBasePointsManager } from './DeliveryBasePointsManager';
import { adminUrl } from '../lib/adminPath';

type Section = 'about' | 'hero' | 'education' | 'skills' | 'projects' | 'projectComments' | 'experience' | 'certificates' | 'deliveryBasePoints' | 'contact' | 'messages' | 'chat' | 'calls' | 'visitors';

interface AdminDashboardProps {
  onLogout: () => void;
}

const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'about', label: 'About', icon: User },
  { id: 'hero', label: 'Hero Media', icon: Images },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'skills', label: 'Skills', icon: Code2 },
  { id: 'projects', label: 'Projects', icon: Briefcase },
  { id: 'projectComments', label: 'Project Comments', icon: MessageSquare },
  { id: 'experience', label: 'Experience', icon: Clock },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'deliveryBasePoints', label: 'Delivery Bases', icon: MapPinned },
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'chat', label: 'Live Chat', icon: MessageCircle },
  { id: 'calls', label: 'Live Calls', icon: PhoneCall },
  { id: 'visitors', label: 'Visitors', icon: UsersRound },
];

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<Section>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('section') === 'calls' ? 'calls' : 'about';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const openLiveCalls = useCallback(() => {
    setActiveSection('calls');
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        setUserEmail(data.user.email);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'OPEN_LIVE_CALLS') {
        setActiveSection('calls');
        setMobileMenuOpen(false);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const nextUrl = activeSection === 'calls' ? adminUrl('calls') : adminUrl();
    window.history.replaceState(null, '', nextUrl);
  }, [activeSection]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'about':
        return <AboutManager />;
      case 'hero':
        return <HeroMediaManager />;
      case 'education':
        return <EducationManager />;
      case 'skills':
        return <SkillsManager />;
      case 'projects':
        return <ProjectsManager />;
      case 'projectComments':
        return <ProjectCommentsManager />;
      case 'experience':
        return <ExperienceManager />;
      case 'certificates':
        return <CertificatesManager />;
      case 'deliveryBasePoints':
        return <DeliveryBasePointsManager />;
      case 'contact':
        return <ContactManager />;
      case 'messages':
        return <MessagesManager />;
      case 'chat':
        return <AdminChatManager />;
      case 'calls':
        return <LiveCallManager />;
      case 'visitors':
        return <VisitorsManager />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminGlobalCallRinger activeSection={activeSection} onOpenCalls={openLiveCalls} />
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-slate-900 border-r border-slate-800 pt-6 overflow-y-auto">
          <div className="px-6 mb-8">
            <a href="/" className="flex items-center gap-3 text-gray-100 hover:text-amber-400 transition-colors">
              <Home size={20} />
              <span className="font-medium">View Portfolio</span>
            </a>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ChevronRight size={16} className="ml-auto" />}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="px-4 py-3 mb-4">
              <p className="text-sm text-gray-500">Logged in as</p>
              <p className="text-sm text-gray-300 truncate">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700 hover:text-gray-100 transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center justify-between px-4 h-16">
          <button
            onClick={() => setActiveSection('about')}
            className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"
          >
            Admin
          </button>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
            >
              <Home size={20} />
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400'
                      : 'text-gray-400'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
            <div className="pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-gray-100 transition-colors"
              >
                <LogOut size={20} />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="lg:pl-72 pt-20 lg:pt-0">
        <div className="p-4 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-100">
                {navItems.find((n) => n.id === activeSection)?.label} Manager
              </h1>
              <p className="text-gray-500 mt-2">
                Manage your portfolio {activeSection} content
              </p>
            </div>
            {renderSection()}
          </div>
        </div>
      </main>
    </div>
  );
}

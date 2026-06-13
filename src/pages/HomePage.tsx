import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Product, Category } from '../lib/types';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../contexts/AuthContext';
import {
  Flame, Package, Wrench, Shield, Truck, ChevronRight,
  Star, MapPin, Clock, Sparkles
} from 'lucide-react';
import OffersCarousel from '../components/OffersCarousel';

const categoryIcons: Record<string, typeof Flame> = {
  cylinders: Flame,
  installation: Wrench,
  stoves: Package,
  accessories: Shield,
  services: Truck,
};

export default function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [cylinders, setCylinders] = useState<Product[]>([]);
  const [services, setServices] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [catRes, bestRes, cylRes, svcRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('products').select('*, category:categories(*)').eq('is_bestseller', true).eq('is_available', true).order('sort_order'),
        supabase.from('products').select('*, category:categories(*)').eq('is_available', true).in('type', ['new', 'refill']).order('sort_order').limit(6),
        supabase.from('products').select('*, category:categories(*)').eq('type', 'service').eq('is_available', true).order('sort_order'),
      ]);
      setCategories(catRes.data || []);
      setBestsellers(bestRes.data || []);
      setCylinders(cylRes.data || []);
      setServices(svcRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-white/5 rounded-full" />
          <div className="absolute top-10 right-10 w-40 h-40 bg-white/5 rounded-full" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-blue-100 text-sm font-medium">{greeting()},</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">{profile?.full_name || 'Welcome'}</h1>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <img src="/CylinderExprerssLOGO.png" alt="" className="w-8 h-8 object-contain" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: Truck, label: 'Fast Delivery', sub: 'Same-day in Dhaka' },
              { icon: Shield, label: 'Safe & Verified', sub: 'Quality assured' },
              { icon: Clock, label: '24/7 Support', sub: 'Always available' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4">
                <Icon className="w-5 h-5 text-blue-200 mb-2" />
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-blue-200 text-xs">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Offers Carousel */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Special Offers</h2>
            </div>
            <button
              onClick={() => navigate('/offers')}
              className="text-blue-600 text-sm font-semibold flex items-center gap-1 hover:text-blue-700"
            >
              All Offers <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <OffersCarousel />
        </section>

        {/* Categories */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Shop by Category</h2>
            <button
              onClick={() => navigate('/products')}
              className="text-blue-600 text-sm font-semibold flex items-center gap-1 hover:text-blue-700"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {categories.map(cat => {
              const Icon = categoryIcons[cat.slug] || Package;
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/products?category=${cat.slug}`)}
                  className="flex min-h-[112px] flex-col items-center justify-center gap-2 p-3 sm:p-4 bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 text-center leading-tight">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* LPG Cylinders */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">LPG Cylinders</h2>
            <button
              onClick={() => navigate('/products?category=lpg-cylinders')}
              className="text-blue-600 text-sm font-semibold flex items-center gap-1 hover:text-blue-700"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {cylinders.slice(0, 4).map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Best Sellers */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Best Sellers</h2>
            </div>
            <button
              onClick={() => navigate('/products?bestseller=true')}
              className="text-blue-600 text-sm font-semibold flex items-center gap-1 hover:text-blue-700"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {bestsellers.slice(0, 4).map(p => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </section>

        {/* Services */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Services</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {services.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                className="flex items-start sm:items-center gap-3 sm:gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all group text-left"
              >
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
                  <Truck className="w-7 h-7 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-1">{p.description}</p>
                </div>
                <div className="text-right flex-shrink-0 min-w-[76px]">
                  <p className="font-bold text-blue-600">৳{p.price.toLocaleString()}</p>
                  <span className="text-xs text-gray-400">Book Now</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Location CTA */}
        <section>
          <button
            onClick={() => navigate('/addresses')}
            className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-gray-900">Set Delivery Location</h3>
              <p className="text-sm text-gray-500">Share your location for faster delivery</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </section>
      </div>
    </div>
  );
}

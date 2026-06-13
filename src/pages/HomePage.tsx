import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Product, Category } from '../lib/types';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../contexts/AuthContext';
import {
  Flame, Package, Wrench, Shield, Truck, ChevronRight,
  Star, MapPin, Sparkles, Phone, ShoppingBag, Headphones
} from 'lucide-react';
import OffersCarousel from '../components/OffersCarousel';

const categoryIcons: Record<string, typeof Flame> = {
  cylinders: Flame,
  installation: Wrench,
  stoves: Package,
  accessories: Shield,
  services: Truck,
};

const heroSlides = [
  {
    image: '/hero-banner-1.png',
    badge: 'দ্রুত • নিরাপদ • নির্ভরযোগ্য',
    title: 'গ্যাস সিলিন্ডার এখন আরও সহজ!',
    subtitle: 'বাড়িতে বসেই অর্ডার করুন, আমরা পৌঁছে দেবো আপনার কাছে',
    stats: [
      { icon: ShoppingBag, label: '10K+', sub: 'সন্তুষ্ট গ্রাহক' },
      { icon: Truck, label: '50K+', sub: 'ডেলিভারি সম্পন্ন' },
      { icon: Shield, label: '100%', sub: 'নিরাপদ সেবা' },
    ],
  },
  {
    image: '/hero-banner-2.png',
    badge: 'দ্রুত • নিরাপদ • নির্ভরযোগ্য',
    title: 'দ্রুত, নিরাপদ ও নির্ভরযোগ্য গ্যাস সেবা',
    subtitle: 'আপনার নিরাপত্তা আমাদের অগ্রাধিকার',
    stats: [
      { icon: Shield, label: 'নিরাপদ', sub: 'ডেলিভারি' },
      { icon: Truck, label: 'দ্রুত', sub: 'সার্ভিস' },
      { icon: Headphones, label: '২৪/৭', sub: 'কাস্টমার সাপোর্ট' },
    ],
  },
];

export default function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [cylinders, setCylinders] = useState<Product[]>([]);
  const [services, setServices] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const currentSlide = useMemo(() => heroSlides[heroIndex], [heroIndex]);

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
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-white to-orange-50/70" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-blue-700 text-sm font-medium">{greeting()},</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                {profile?.full_name || 'Welcome'}
              </h1>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <Phone className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500">Hotline</p>
                <p className="text-sm font-bold text-blue-700">01409472939</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] shadow-xl border border-blue-100 bg-blue-950">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-950/70 via-blue-900/30 to-transparent z-10" />
            <img
              src={currentSlide.image}
              alt="Cylinder Express hero banner"
              className="w-full h-[240px] sm:h-[420px] lg:h-[520px] object-cover object-center"
            />

            <div className="absolute inset-0 z-20 flex items-center">
              <div className="w-full max-w-2xl px-5 sm:px-8 lg:px-10 py-6">
                <div className="inline-flex items-center rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-white text-xs sm:text-sm font-semibold mb-3 sm:mb-4">
                  {currentSlide.badge}
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold leading-tight text-white drop-shadow-sm max-w-xl">
                  {currentSlide.title}
                </h2>
                <p className="text-white/90 text-sm sm:text-base lg:text-xl mt-3 max-w-lg leading-relaxed">
                  {currentSlide.subtitle}
                </p>

                <div className="mt-5 sm:mt-7 flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate('/products')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 text-sm sm:text-base font-semibold shadow-lg shadow-blue-800/20"
                  >
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                    অর্ডার করুন
                  </button>
                  <button
                    onClick={() => navigate('/contact-us')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 text-white px-5 py-3 text-sm sm:text-base font-semibold"
                  >
                    <Headphones className="w-4 h-4 sm:w-5 sm:h-5" />
                    সহায়তা নিন
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute z-20 left-4 right-4 bottom-4 sm:left-6 sm:right-6 sm:bottom-6 lg:left-10 lg:right-10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl bg-white/92 backdrop-blur-md border border-white/60 p-3 sm:p-4 shadow-lg">
                {currentSlide.stats.map(({ icon: Icon, label, sub }) => (
                  <div key={`${label}-${sub}`} className="flex items-center gap-3 rounded-xl px-2 py-2">
                    <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-blue-700 font-bold text-base sm:text-lg">{label}</p>
                      <p className="text-gray-600 text-xs sm:text-sm">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-4">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setHeroIndex(index)}
                className={`h-2.5 rounded-full transition-all ${heroIndex === index ? 'w-7 bg-blue-600' : 'w-2.5 bg-blue-200 hover:bg-blue-300'}`}
                aria-label={`Show hero slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

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

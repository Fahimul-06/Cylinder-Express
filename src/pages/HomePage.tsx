import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Product, Category } from '../lib/types';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import {
  Flame, Package, Wrench, Shield, Truck, ChevronRight,
  Star, MapPin, Sparkles
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
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [cylinders, setCylinders] = useState<Product[]>([]);
  const [services, setServices] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroImages = ['/home-hero-1.png', '/home-hero-2.png', '/home-hero-3.png', '/home-hero-4.png', '/home-hero-5.png'];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroImages.length]);

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
      <div className="bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
            <div className="relative aspect-[16/10] sm:aspect-[16/8] lg:aspect-[16/7]">
              {heroImages.map((image, index) => (
                <img
                  key={image}
                  src={image}
                  alt={`Cylinder Express hero ${index + 1}`}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${heroIndex === index ? 'opacity-100' : 'opacity-0'}`}
                />
              ))}
            </div>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/20 px-3 py-1.5 backdrop-blur-sm">
              {heroImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setHeroIndex(index)}
                  aria-label={`Show hero slide ${index + 1}`}
                  className={`h-2.5 rounded-full transition-all ${heroIndex === index ? 'w-6 bg-white' : 'w-2.5 bg-white/60'}`}
                />
              ))}
            </div>
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

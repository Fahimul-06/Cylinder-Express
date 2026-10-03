import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Product, Category, HeroSlide, Offer, PartnerBrand } from '../lib/types';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import {
  Flame, Package, Wrench, Shield, Truck, ChevronRight,
  Star, MapPin, Sparkles, Tag, Handshake, ChevronLeft, X
} from 'lucide-react';
import { dedupeCustomerProducts } from '../lib/productCatalog';

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
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [partnerBrands, setPartnerBrands] = useState<PartnerBrand[]>([]);
  const [openingOffer, setOpeningOffer] = useState<Offer | null>(null);
  const [showOpeningOffer, setShowOpeningOffer] = useState(false);
  const partnerSliderRef = useRef<HTMLDivElement>(null);
  const fallbackHeroImages = ['/home-hero-1.png', '/home-hero-2.png'];
  const heroImages = heroSlides.length > 0 ? heroSlides.map(slide => slide.image_url) : fallbackHeroImages;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroImages.length]);

  useEffect(() => {
    if (partnerBrands.length < 2) return;
    const timer = window.setInterval(() => {
      const el = partnerSliderRef.current;
      if (!el) return;
      const first = el.querySelector<HTMLElement>('[data-partner-card]');
      const step = (first?.offsetWidth || 180) + 12;
      const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - step;
      el.scrollTo({ left: nearEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' });
    }, 3200);
    return () => window.clearInterval(timer);
  }, [partnerBrands.length]);

  function scrollPartners(direction: -1 | 1) {
    const el = partnerSliderRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('[data-partner-card]');
    const step = (first?.offsetWidth || 180) + 12;
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  useEffect(() => {
    async function fetchData() {
      const [catRes, bestRes, cylRes, svcRes, heroRes, offerRes, partnerRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('products').select('*, category:categories(*)').eq('is_bestseller', true).eq('is_available', true).order('sort_order'),
        supabase.from('products').select('*, category:categories(*)').eq('is_available', true).in('type', ['new', 'refill']).order('sort_order').limit(6),
        supabase.from('products').select('*, category:categories(*)').eq('type', 'service').eq('is_available', true).order('sort_order'),
        supabase.from('hero_slides').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('offers').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('partner_brands').select('*').eq('is_active', true).order('sort_order'),
      ]);

      const allActiveOffers = (offerRes.data || []) as Offer[];
      const now = Date.now();
      const isCurrentlyValid = (offer: Offer) =>
        (!offer.valid_from || new Date(offer.valid_from).getTime() <= now) &&
        (!offer.valid_until || new Date(offer.valid_until).getTime() >= now);

      const activeProductOffers = allActiveOffers
        .filter(offer => offer.product_id && isCurrentlyValid(offer));

      // The old Special Offers box is removed from Home. Instead the first
      // active special offer (admin sort order) is shown once per app/tab session
      // as a floating opening banner.
      const firstSpecialOffer = allActiveOffers.find(offer => !offer.product_id && isCurrentlyValid(offer)) || null;
      setOpeningOffer(firstSpecialOffer);
      if (firstSpecialOffer) {
        try {
          setShowOpeningOffer(sessionStorage.getItem(`cx_offer_banner_dismissed_${firstSpecialOffer.id}`) !== '1');
        } catch {
          setShowOpeningOffer(true);
        }
      } else {
        setShowOpeningOffer(false);
      }
      const saleIds = [...new Set(activeProductOffers.map(offer => offer.product_id!).filter(Boolean))];
      let saleItems: Product[] = [];
      if (saleIds.length > 0) {
        const saleRes = await supabase
          .from('products')
          .select('*, category:categories(*)')
          .eq('is_available', true)
          .in('id', saleIds)
          .order('sort_order');
        saleItems = (saleRes.data || []).map((product: Product) => ({
          ...product,
          active_offer: activeProductOffers.find(offer => offer.product_id === product.id) || null,
        }));
      }

      const attachOffers = (items: Product[]) => items.map(item => ({
        ...item,
        active_offer: activeProductOffers.find(offer => offer.product_id === item.id) || null,
      }));

      setCategories(catRes.data || []);
      setBestsellers(dedupeCustomerProducts(attachOffers(bestRes.data || [])));
      setCylinders(dedupeCustomerProducts(attachOffers(cylRes.data || [])).filter(p => p.category?.slug === 'lpg-cylinders').slice(0, 6));
      setServices(attachOffers(svcRes.data || []));
      setSaleProducts(dedupeCustomerProducts(saleItems).slice(0, 8));
      setHeroSlides(heroRes.data || []);
      setPartnerBrands(partnerRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);


  function dismissOpeningOffer() {
    if (openingOffer) {
      try {
        sessionStorage.setItem(`cx_offer_banner_dismissed_${openingOffer.id}`, '1');
      } catch {
        // Storage can be unavailable in restricted browser modes; hiding still works.
      }
    }
    setShowOpeningOffer(false);
  }

  function openOpeningOffer() {
    if (!openingOffer) return;
    dismissOpeningOffer();
    if (openingOffer.product_id) {
      navigate(`/product/${openingOffer.product_id}`);
    } else if (openingOffer.category_slug) {
      navigate(`/products?category=${encodeURIComponent(openingOffer.category_slug)}`);
    } else {
      navigate('/products');
    }
  }

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
      {openingOffer && showOpeningOffer && (
        <div className="fixed inset-x-0 bottom-4 sm:bottom-6 z-[80] px-3 sm:px-6 pointer-events-none">
          <div className={`pointer-events-auto relative max-w-xl mx-auto overflow-hidden rounded-2xl shadow-2xl border border-white/30 bg-gradient-to-r ${openingOffer.bg_from} ${openingOffer.bg_to}`}>
            <button
              type="button"
              onClick={dismissOpeningOffer}
              aria-label="Close special offer"
              className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-black/30 hover:bg-black/45 text-white flex items-center justify-center backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={openOpeningOffer}
              className="w-full text-left flex items-stretch min-h-[112px] sm:min-h-[126px]"
              aria-label={`Open offer: ${openingOffer.title}`}
            >
              {openingOffer.image_url ? (
                <div className="w-28 sm:w-36 flex-shrink-0 bg-black/10 overflow-hidden">
                  <img src={openingOffer.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 sm:w-28 flex-shrink-0 bg-white/10 flex items-center justify-center">
                  <Sparkles className="w-9 h-9 text-white" />
                </div>
              )}

              <div className="min-w-0 flex-1 p-4 pr-11 text-white">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide">
                    {openingOffer.badge_text || 'SPECIAL OFFER'}
                  </span>
                  <span className="text-xs font-bold text-white/95">
                    {openingOffer.discount_type === 'percentage'
                      ? `${openingOffer.discount_value}% OFF`
                      : `৳${openingOffer.discount_value.toLocaleString()} OFF`}
                  </span>
                </div>
                <h3 className="font-bold text-base sm:text-lg leading-tight line-clamp-2">{openingOffer.title}</h3>
                {openingOffer.description && (
                  <p className="mt-1 text-xs sm:text-sm text-white/80 line-clamp-1">{openingOffer.description}</p>
                )}
                <span className="mt-2 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold">
                  View offer products <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

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
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ${heroIndex === index ? 'opacity-100' : 'opacity-0'}`}
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
        {saleProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-bold text-gray-900">Sale Products</h2>
              </div>
              <button
                onClick={() => navigate('/offers')}
                className="text-blue-600 text-sm font-semibold flex items-center gap-1 hover:text-blue-700"
              >
                View Offers <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {saleProducts.slice(0, 4).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {services.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                className="overflow-hidden bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all group text-left"
              >
                <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-blue-50 flex items-center justify-center">
                      <Wrench className="w-9 h-9 text-blue-600" />
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2 py-1 text-xs font-bold text-blue-600 shadow-sm">
                    ৳{p.price.toLocaleString()}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 line-clamp-1">{p.name}</h3>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2 min-h-[2rem]">{p.description || 'Professional service at your doorstep'}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                    Book Now <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Partner Brands */}
        {partnerBrands.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Handshake className="w-5 h-5 text-blue-600" />
                <div><h2 className="text-lg font-bold text-gray-900">Partner Brands</h2><p className="text-xs text-gray-500">Trusted LPG and service partners</p></div>
              </div>
              {partnerBrands.length > 2 && <div className="hidden sm:flex items-center gap-1"><button type="button" onClick={() => scrollPartners(-1)} className="p-2 rounded-full border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200"><ChevronLeft className="w-4 h-4" /></button><button type="button" onClick={() => scrollPartners(1)} className="p-2 rounded-full border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200"><ChevronRight className="w-4 h-4" /></button></div>}
            </div>
            <div ref={partnerSliderRef} className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {partnerBrands.map(brand => (
                <div data-partner-card key={brand.id} className="snap-start flex-none w-[42%] sm:w-[28%] md:w-[22%] lg:w-[18%] min-w-[135px] max-w-[210px] rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4 flex flex-col items-center justify-center text-center min-h-[130px] hover:border-blue-200 hover:bg-blue-50/40 transition-colors">
                  <div className="h-16 sm:h-20 w-full flex items-center justify-center"><img src={brand.logo_url} alt={brand.name} loading="lazy" className="max-h-full max-w-full object-contain" /></div>
                  <p className="mt-3 text-xs sm:text-sm font-semibold text-gray-800 line-clamp-1">{brand.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

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

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Offer } from '../lib/types';
import { Tag, Copy, Check, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

export default function OffersCarousel() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [current, setCurrent] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase
      .from('offers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .limit(6)
      .then(({ data }) => setOffers(data || []));
  }, []);

  useEffect(() => {
    if (offers.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % offers.length);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [offers.length]);

  const go = (dir: 1 | -1) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCurrent(c => (c + dir + offers.length) % offers.length);
  };

  const copyCode = async (code: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const daysLeft = (until: string | null) => {
    if (!until) return null;
    const diff = Math.ceil((new Date(until).getTime() - Date.now()) / 86400000);
    if (diff <= 0) return null;
    if (diff === 1) return 'Last day!';
    return `${diff} days left`;
  };

  if (offers.length === 0) return null;

  const offer = offers[current];

  return (
    <div className="relative select-none">
      {/* Card */}
      <div
        className={`bg-gradient-to-r ${offer.bg_from} ${offer.bg_to} rounded-2xl overflow-hidden cursor-pointer`}
        onClick={() => navigate(offer.product_id ? `/product/${offer.product_id}` : offer.category_slug ? `/products?category=${offer.category_slug}` : '/offers')}
      >
        {offer.image_url && (
          <div className="relative h-36 sm:h-44 overflow-hidden bg-black/10">
            <img src={offer.image_url} alt={offer.title} className="h-full w-full object-cover opacity-95" />
            <div className={`absolute inset-0 bg-gradient-to-r ${offer.bg_from} ${offer.bg_to} opacity-45`} />
          </div>
        )}
        <div className="relative p-5 sm:p-6">
          {/* decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full mb-2">
                <Tag className="w-3 h-3" />
                {offer.badge_text}
              </span>
              <h3 className="text-white font-bold text-lg sm:text-xl leading-tight">{offer.title}</h3>
              {offer.description && (
                <p className="text-white/80 text-sm mt-1 line-clamp-2 leading-relaxed">{offer.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="bg-white/20 text-white text-sm font-bold px-3 py-1 rounded-full">
                  {offer.discount_type === 'percentage'
                    ? `${offer.discount_value}% OFF`
                    : `৳${offer.discount_value.toLocaleString()} OFF`}
                </span>

                {daysLeft(offer.valid_until) && (
                  <span className="flex items-center gap-1 text-white/70 text-xs">
                    <Clock className="w-3 h-3" /> {daysLeft(offer.valid_until)}
                  </span>
                )}
              </div>

              {offer.code && (
                <button
                  onClick={e => copyCode(offer.code!, offer.id, e)}
                  className="flex items-center gap-2 mt-3 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-3 py-1.5"
                >
                  <span className="font-mono font-bold text-white tracking-widest text-sm">{offer.code}</span>
                  {copiedId === offer.id ? (
                    <Check className="w-3.5 h-3.5 text-green-300 flex-shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                  )}
                </button>
              )}
            </div>

            <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm">
              <span className="text-white font-black text-xl sm:text-2xl leading-none">
                {offer.discount_type === 'percentage' ? `${offer.discount_value}%` : `৳${offer.discount_value}`}
              </span>
              <span className="text-white/70 text-xs font-semibold">OFF</span>
            </div>
          </div>
        </div>
      </div>

      {offers.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); go(-1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); go(1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {offers.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {offers.map((_, i) => (
            <button
              key={i}
              onClick={() => { if (intervalRef.current) clearInterval(intervalRef.current); setCurrent(i); }}
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'w-5 h-2 bg-blue-600' : 'w-2 h-2 bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Offer } from '../lib/types';
import { Tag, Copy, Check, Clock, ChevronRight, Percent, BadgeDollarSign, Sparkles } from 'lucide-react';

export default function OffersPage() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOffers() {
      const { data } = await supabase
        .from('offers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      setOffers(data || []);
      setLoading(false);
    }
    fetchOffers();
  }, []);

  const copyCode = async (code: string, offerId: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(offerId);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const daysLeft = (until: string | null) => {
    if (!until) return null;
    const diff = Math.ceil((new Date(until).getTime() - Date.now()) / 86400000);
    if (diff <= 0) return 'Expired';
    if (diff === 1) return 'Last day!';
    return `${diff} days left`;
  };

  const urgencyColor = (until: string | null) => {
    if (!until) return 'text-gray-400';
    const diff = Math.ceil((new Date(until).getTime() - Date.now()) / 86400000);
    if (diff <= 1) return 'text-red-500';
    if (diff <= 7) return 'text-amber-500';
    return 'text-gray-400';
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
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute top-6 right-8 w-32 h-32 bg-white/5 rounded-full" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Special Offers</h1>
          </div>
          <p className="text-blue-100 text-sm sm:text-base">Exclusive deals on LPG cylinders, installations &amp; services</p>

          <div className="flex gap-3 mt-5">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
              <p className="text-white font-bold text-xl">{offers.length}</p>
              <p className="text-blue-200 text-xs">Active Offers</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
              <p className="text-white font-bold text-xl">{offers.filter(o => o.code).length}</p>
              <p className="text-blue-200 text-xs">Promo Codes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {offers.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag className="w-10 h-10 text-blue-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No active offers right now</h3>
            <p className="text-gray-500 text-sm">Check back soon for exciting deals!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {offers.map(offer => {
              const timeLeft = daysLeft(offer.valid_until);
              const timeColor = urgencyColor(offer.valid_until);
              const isCopied = copiedCode === offer.id;

              return (
                <div
                  key={offer.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group"
                >
                  {offer.image_url && (
                    <div className="h-44 sm:h-52 overflow-hidden bg-gray-100">
                      <img src={offer.image_url} alt={offer.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}

                  {/* Gradient band */}
                  <div className={`bg-gradient-to-r ${offer.bg_from} ${offer.bg_to} p-5 relative overflow-hidden`}>
                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
                    <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full" />
                    <div className="relative">
                      <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                        <Tag className="w-3 h-3" />
                        {offer.badge_text}
                      </span>
                      <h3 className="text-white font-bold text-lg leading-tight">{offer.title}</h3>
                      {offer.description && (
                        <p className="text-white/80 text-sm mt-1.5 leading-relaxed">{offer.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    {/* Discount badge */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                        {offer.discount_type === 'percentage' ? (
                          <Percent className="w-4 h-4 text-blue-500" />
                        ) : (
                          <BadgeDollarSign className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="text-blue-700 font-bold text-sm">
                          {offer.discount_type === 'percentage'
                            ? `${offer.discount_value}% OFF`
                            : `৳${offer.discount_value.toLocaleString()} OFF`}
                        </span>
                      </div>
                      {timeLeft && (
                        <span className={`flex items-center gap-1 text-xs font-medium ${timeColor}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {timeLeft}
                        </span>
                      )}
                    </div>

                    {/* Promo code */}
                    {offer.code && (
                      <button
                        onClick={() => copyCode(offer.code!, offer.id)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group/code"
                      >
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-gray-400 group-hover/code:text-blue-500 transition-colors" />
                          <span className="font-mono font-bold text-gray-700 tracking-widest text-sm group-hover/code:text-blue-700 transition-colors">
                            {offer.code}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-semibold transition-colors ${
                          isCopied ? 'text-green-600' : 'text-gray-400 group-hover/code:text-blue-500'
                        }`}>
                          {isCopied ? (
                            <><Check className="w-3.5 h-3.5" /> Copied!</>
                          ) : (
                            <><Copy className="w-3.5 h-3.5" /> Copy</>
                          )}
                        </div>
                      </button>
                    )}

                    {/* CTA */}
                    <button
                      onClick={() => {
                        if (offer.product_id) {
                          navigate(`/product/${offer.product_id}`);
                        } else if (offer.category_slug) {
                          navigate(`/products?category=${offer.category_slug}`);
                        } else {
                          navigate('/products');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
                    >
                      Shop Now <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

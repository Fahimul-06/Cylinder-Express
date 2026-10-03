import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Offer } from '../lib/types';
import { Tag } from 'lucide-react';

export default function OffersPage() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOffers() {
      const { data } = await supabase
        .from('offers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      const visibleOffers = ((data || []) as Offer[])
        .filter(offer => !!offer.image_url)
        .filter(offer => !offer.valid_from || new Date(offer.valid_from) <= new Date())
        .filter(offer => !offer.valid_until || new Date(offer.valid_until) >= new Date());

      setOffers(visibleOffers);
      setLoading(false);
    }

    fetchOffers();
  }, []);

  function openOffer(offer: Offer) {
    if (offer.product_id) {
      navigate(`/product/${offer.product_id}`);
      return;
    }
    if (offer.category_slug) {
      navigate(`/products?category=${encodeURIComponent(offer.category_slug)}`);
      return;
    }
    navigate('/products');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-xl" />
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Special Offers</h1>
          <p className="mt-1 text-sm text-gray-500">Tap an offer image to view its related products.</p>
        </div>

        {offers.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No active offers right now</h3>
            <p className="text-gray-500 text-sm">Check back soon for new offers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {offers.map(offer => (
              <button
                key={offer.id}
                type="button"
                onClick={() => openOffer(offer)}
                className="group block w-full overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label={`Open offer: ${offer.title}`}
              >
                <img
                  src={offer.image_url!}
                  alt={offer.title}
                  className="block w-full h-auto aspect-[16/9] object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

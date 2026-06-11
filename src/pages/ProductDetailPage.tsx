import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Product } from '../lib/types';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ShoppingCart, Star, Flame, RotateCcw, Wrench, MapPin,
  ChevronRight, Minus, Plus, Calendar, Clock, Truck
} from 'lucide-react';
import { SERVICE_TIME_SLOTS } from '../lib/constants';

const typeConfig = {
  new: { icon: Flame, label: 'New', color: 'bg-emerald-50 text-emerald-700' },
  refill: { icon: RotateCcw, label: 'Refill', color: 'bg-blue-50 text-blue-700' },
  service: { icon: Wrench, label: 'Service', color: 'bg-amber-50 text-amber-700' },
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, getItemQuantity, updateQuantity } = useCart();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('id', id)
        .maybeSingle();
      setProduct(data);
      setLoading(false);
    }
    if (id) fetchProduct();
  }, [id]);

  const cartQty = product ? getItemQuantity(product.id) : 0;

  const handleAddToCart = () => {
    if (!product) return;
    addItem(product, qty);
  };

  const handleBookService = async () => {
    if (!product || !user) return;
    if (!bookingDate || !bookingTime) return;
    setBookingLoading(true);
    const { error } = await supabase.from('service_bookings').insert({
      product_id: product.id,
      scheduled_date: bookingDate,
      scheduled_time: bookingTime,
      notes: bookingNotes,
    });
    if (!error) {
      setBookingSubmitted(true);
    }
    setBookingLoading(false);
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

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Product not found</h2>
          <button onClick={() => navigate('/products')} className="text-blue-600 font-semibold">
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  const tc = typeConfig[product.type];
  const TypeIcon = tc.icon;
  const isService = product.type === 'service';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <button onClick={() => navigate('/home')} className="hover:text-blue-600">Home</button>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => navigate('/products')} className="hover:text-blue-600">Products</button>
          {product.category && (
            <>
              <ChevronRight className="w-3 h-3" />
              <button onClick={() => navigate(`/products?category=${product.category!.slug}`)} className="hover:text-blue-600">
                {product.category.name}
              </button>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900 font-medium">{product.name}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-white border border-gray-100">
            <img
              src={product.image_url || 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=600'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 flex gap-2">
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${tc.color}`}>
                <TypeIcon className="w-4 h-4" />
                {tc.label}
              </span>
              {product.is_bestseller && (
                <span className="flex items-center gap-1 bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-full">
                  <Star className="w-4 h-4" /> Best Seller
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{product.name}</h1>
              {product.size && (
                <span className="inline-block mt-2 px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">
                  Size: {product.size}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">৳{product.price.toLocaleString()}</span>
              {product.unit !== 'piece' && (
                <span className="text-gray-400">/ {product.unit}</span>
              )}
            </div>

            {product.description && (
              <p className="text-gray-600 leading-relaxed">{product.description}</p>
            )}

            {isService ? (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Professional service at your doorstep</span>
                </div>

                {bookingSubmitted ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Calendar className="w-7 h-7 text-green-600" />
                    </div>
                    <h3 className="font-bold text-green-900 text-lg mb-1">Booking Confirmed!</h3>
                    <p className="text-green-700 text-sm">
                      {bookingDate} at {bookingTime}
                    </p>
                    <button
                      onClick={() => navigate('/orders')}
                      className="mt-4 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                    >
                      View My Bookings
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <Calendar className="w-4 h-4 inline mr-1.5" />Preferred Date
                      </label>
                      <input
                        type="date"
                        value={bookingDate}
                        onChange={e => setBookingDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <Clock className="w-4 h-4 inline mr-1.5" />Preferred Time
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {SERVICE_TIME_SLOTS.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setBookingTime(slot)}
                            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              bookingTime === slot
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (Optional)</label>
                      <textarea
                        value={bookingNotes}
                        onChange={e => setBookingNotes(e.target.value)}
                        placeholder="Any special requirements..."
                        rows={3}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none"
                      />
                    </div>
                    <button
                      onClick={handleBookService}
                      disabled={bookingLoading || !bookingDate || !bookingTime}
                      className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                    >
                      {bookingLoading ? 'Booking...' : `Book Service - ৳${product.price.toLocaleString()}`}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Quantity:</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-semibold text-gray-900 text-lg">{qty}</span>
                    <button
                      onClick={() => setQty(qty + 1)}
                      className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {cartQty > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
                      <span className="text-green-700 font-medium text-sm">{cartQty} in cart</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(product.id, cartQty - 1)}
                          className="w-8 h-8 rounded-lg bg-green-100 text-green-700 font-bold hover:bg-green-200 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="font-semibold">{cartQty}</span>
                        <button
                          onClick={() => updateQuantity(product.id, cartQty + 1)}
                          className="w-8 h-8 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/cart')}
                      className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      Go to Cart - ৳{(cartQty * product.price).toLocaleString()}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAddToCart}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart - ৳{(qty * product.price).toLocaleString()}
                  </button>
                )}

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Delivery across Bangladesh</p>
                    <p className="text-xs text-blue-700 mt-0.5">Same-day delivery available in Dhaka. Set your delivery address for accurate ETA.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

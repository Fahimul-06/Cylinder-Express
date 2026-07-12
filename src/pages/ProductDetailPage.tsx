import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Product, Offer } from '../lib/types';
import { buildCartItemKey, useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ShoppingCart, Star, Flame, RotateCcw, Wrench, MapPin,
  ChevronRight, Minus, Plus, Calendar, Clock, Truck, Tag
} from 'lucide-react';
import { SERVICE_TIME_SLOTS } from '../lib/constants';
import { isLpgCylinder } from '../lib/deliveryCharges';
import ProductCard from '../components/ProductCard';
import { LPG_VALVE_CONNECTIONS, LPG_VALVE_SIZES } from '../lib/productOptions';
import { getCylinderBottlePrice, getCylinderGasPrice, getProductPriceForOrderType } from '../lib/cylinderPricing';
import { dedupeCustomerProducts, getLpgDisplayName } from '../lib/productCatalog';

const typeConfig = {
  new: { icon: Flame, label: 'New', color: 'bg-emerald-50 text-emerald-700' },
  refill: { icon: RotateCcw, label: 'Refill', color: 'bg-blue-50 text-blue-700' },
  service: { icon: Wrench, label: 'Service', color: 'bg-amber-50 text-amber-700' },
};

function isActiveOffer(offer?: Offer | null) {
  if (!offer || !offer.is_active) return false;
  if (offer.valid_until && new Date(offer.valid_until) < new Date()) return false;
  return true;
}

function getDiscountedPrice(price: number, offer?: Offer | null) {
  if (!isActiveOffer(offer)) return price;
  if (offer!.discount_type === 'percentage') return Math.max(0, Math.round(price - (price * offer!.discount_value) / 100));
  return Math.max(0, Math.round(price - offer!.discount_value));
}

function getOfferLabel(offer?: Offer | null) {
  if (!isActiveOffer(offer)) return null;
  return offer!.discount_type === 'percentage'
    ? `${offer!.discount_value}% OFF`
    : `৳${offer!.discount_value.toLocaleString()} OFF`;
}


export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, getItemQuantity, updateQuantity } = useCart();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [selectedValveSize, setSelectedValveSize] = useState('');
  const [selectedValveType, setSelectedValveType] = useState('');
  const [selectedCylinderOrderType, setSelectedCylinderOrderType] = useState<'new' | 'refill' | ''>('');

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('id', id)
        .maybeSingle();

      setSelectedValveSize('');
      setSelectedValveType('');
      setSelectedCylinderOrderType('');

      if (data) {
        const [{ data: related }, { data: offerData }] = await Promise.all([
          supabase
            .from('products')
            .select('*, category:categories(*)')
            .eq('is_available', true)
            .order('sort_order'),
          supabase
            .from('offers')
            .select('*')
            .eq('is_active', true)
            .order('sort_order'),
        ]);

        const activeProductOffers = ((offerData || []) as Offer[])
          .filter(offer => offer.product_id && (!offer.valid_until || new Date(offer.valid_until) >= new Date()));
        const productOffer = activeProductOffers.find(offer => offer.product_id === data.id) || null;
        setProduct({ ...data, active_offer: productOffer });

        const scored = dedupeCustomerProducts((related || []) as Product[])
          .filter(item => item.id !== data.id)
          .map((item: Product) => ({
            item: { ...item, active_offer: activeProductOffers.find(offer => offer.product_id === item.id) || null },
            score:
              (item.category_id === data.category_id ? 4 : 0) +
              (item.type === data.type ? 2 : 0) +
              (item.company_name && item.company_name === data.company_name ? 2 : 0),
          }))
          .sort((a: { item: Product; score: number }, b: { item: Product; score: number }) => b.score - a.score || a.item.name.localeCompare(b.item.name))
          .slice(0, 8)
          .map(({ item }: { item: Product; score: number }) => item);
        setRelatedProducts(scored);
      } else {
        setProduct(null);
        setRelatedProducts([]);
      }

      setLoading(false);
    }
    if (id) fetchProduct();
  }, [id]);

  const needsValveSelection = product ? isLpgCylinder(product) : false;
  const needsCylinderTypeSelection = needsValveSelection;
  const selectedCartOptions = needsValveSelection
    ? {
        valve_size: selectedValveSize,
        valve_connection: selectedValveType,
        order_type: selectedCylinderOrderType || null,
      }
    : undefined;
  const cartKey = product ? buildCartItemKey(product.id, selectedCartOptions) : '';
  const cartQty = product ? getItemQuantity(product.id, selectedCartOptions) : 0;

  const handleAddToCart = () => {
    if (!product) return;
    if (needsValveSelection && (!selectedValveSize || !selectedValveType || !selectedCylinderOrderType)) return;
    const selectedBasePrice = getProductPriceForOrderType(product, selectedCylinderOrderType || null);
    const salePrice = getDiscountedPrice(selectedBasePrice, product.active_offer);
    const productForCart = {
      ...product,
      price: salePrice,
      type: selectedCylinderOrderType || product.type,
    };
    addItem(productForCart, qty, selectedCartOptions);
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

  const isCylinder = isLpgCylinder(product);
  const tc = isCylinder ? { icon: Flame, label: 'LPG Cylinder', color: 'bg-blue-50 text-blue-700' } : typeConfig[product.type];
  const TypeIcon = tc.icon;
  const isService = product.type === 'service';
  const displayName = getLpgDisplayName(product);
  const productDetails = [
    product.company_name ? { label: 'Company', value: product.company_name } : null,
    product.size ? { label: 'Size', value: product.size } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  const activeOffer = isActiveOffer(product.active_offer) ? product.active_offer : null;
  const offerLabel = getOfferLabel(activeOffer);
  const selectedBasePrice = getProductPriceForOrderType(product, selectedCylinderOrderType || null);
  const salePrice = getDiscountedPrice(selectedBasePrice, activeOffer);
  const hasSale = Boolean(activeOffer && salePrice < selectedBasePrice);
  const gasPrice = getCylinderGasPrice(product);
  const bottlePrice = getCylinderBottlePrice(product);

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
          <span className="text-gray-900 font-medium">{displayName}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-white border border-gray-100">
            <img
              src={product.image_url || 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=600'}
              alt={displayName}
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
              {offerLabel && (
                <span className="flex items-center gap-1 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-full">
                  <Tag className="w-4 h-4" /> {offerLabel}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{displayName}</h1>
              {productDetails.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {productDetails.map(detail => (
                    <div key={detail.label} className="px-3 py-2 bg-gray-100 rounded-xl">
                      <p className="text-[11px] text-gray-500">{detail.label}</p>
                      <p className="text-sm font-semibold text-gray-800">{detail.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold text-blue-600">৳{salePrice.toLocaleString()}</span>
              {hasSale && <span className="text-lg text-gray-400 line-through">৳{selectedBasePrice.toLocaleString()}</span>}
              {product.unit !== 'piece' && (
                <span className="text-gray-400">/ {product.unit}</span>
              )}
            </div>

            {activeOffer && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-red-700"><Tag className="w-4 h-4" /> {activeOffer.title}</p>
                {activeOffer.description && <p className="text-xs text-red-600 mt-1">{activeOffer.description}</p>}
              </div>
            )}

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
                      {bookingLoading ? 'Booking...' : `Book Service - ৳${salePrice.toLocaleString()}`}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {needsValveSelection && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-4">
                    <div>
                      <h3 className="font-bold text-blue-950">Select cylinder options</h3>
                      <p className="text-xs text-blue-700 mt-1">Choose New/Refill, valve type, and valve size before adding this cylinder to cart.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Cylinder Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['new', 'refill'] as const).map(type => {
                          const Icon = type === 'new' ? Flame : RotateCcw;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setSelectedCylinderOrderType(type)}
                              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border transition-all ${
                                selectedCylinderOrderType === type
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              {type === 'new' ? 'New Cylinder' : 'Refill'}
                            </button>
                          );
                        })}
                      </div>
                      {selectedCylinderOrderType && (
                        <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3">
                          {selectedCylinderOrderType === 'refill' ? (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm text-gray-600">Gas / refill price</span>
                              <strong className="text-blue-700">৳{gasPrice.toLocaleString()}</strong>
                            </div>
                          ) : (
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-gray-600">Gas price</span>
                                <span className="font-medium">৳{gasPrice.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-gray-600">Bottle price</span>
                                <span className="font-medium">৳{bottlePrice.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2">
                                <strong className="text-gray-900">New cylinder price</strong>
                                <strong className="text-blue-700">৳{(gasPrice + bottlePrice).toLocaleString()}</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Valve Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {LPG_VALVE_CONNECTIONS.map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setSelectedValveType(type)}
                            className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all ${
                              selectedValveType === type
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Valve Size</label>
                      <div className="grid grid-cols-2 gap-2">
                        {LPG_VALVE_SIZES.map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setSelectedValveSize(size)}
                            className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all ${
                              selectedValveSize === size
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

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
                          onClick={() => updateQuantity(cartKey, cartQty - 1)}
                          className="w-8 h-8 rounded-lg bg-green-100 text-green-700 font-bold hover:bg-green-200 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="font-semibold">{cartQty}</span>
                        <button
                          onClick={() => updateQuantity(cartKey, cartQty + 1)}
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
                      Go to Cart - ৳{(cartQty * salePrice).toLocaleString()}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAddToCart}
                    disabled={(needsCylinderTypeSelection && !selectedCylinderOrderType) || (needsValveSelection && (!selectedValveSize || !selectedValveType))}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {needsCylinderTypeSelection && !selectedCylinderOrderType
                      ? 'Select New or Refill'
                      : needsValveSelection && (!selectedValveSize || !selectedValveType)
                        ? 'Select Valve Options'
                        : `Add to Cart - ৳${(qty * salePrice).toLocaleString()}`}
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

        {relatedProducts.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Related Products</h2>
                <p className="text-sm text-gray-500">More products and services you may need</p>
              </div>
              <button
                onClick={() => navigate('/products')}
                className="hidden sm:inline-flex text-blue-600 text-sm font-semibold hover:text-blue-700"
              >
                View all
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {relatedProducts.map(item => (
                <ProductCard key={item.id} product={item} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

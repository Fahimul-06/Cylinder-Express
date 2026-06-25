import { Product, Offer } from '../lib/types';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Star, Flame, RotateCcw, Wrench, Truck, Tag } from 'lucide-react';
import { getDeliveryFeeLabel, isLpgCylinder } from '../lib/deliveryCharges';

const typeIcons = {
  new: Flame,
  refill: RotateCcw,
  service: Wrench,
};

const typeColors = {
  new: 'bg-emerald-50 text-emerald-700',
  refill: 'bg-blue-50 text-blue-700',
  service: 'bg-amber-50 text-amber-700',
};

const typeLabels = {
  new: 'New',
  refill: 'Refill',
  service: 'Service',
};

function isActiveOffer(offer?: Offer | null) {
  if (!offer || !offer.is_active) return false;
  if (offer.valid_until && new Date(offer.valid_until) < new Date()) return false;
  return true;
}

function getDiscountedPrice(price: number, offer?: Offer | null) {
  if (!isActiveOffer(offer)) return price;
  if (offer!.discount_type === 'percentage') {
    return Math.max(0, Math.round(price - (price * offer!.discount_value) / 100));
  }
  return Math.max(0, Math.round(price - offer!.discount_value));
}

function getOfferLabel(offer?: Offer | null) {
  if (!isActiveOffer(offer)) return null;
  return offer!.discount_type === 'percentage'
    ? `${offer!.discount_value}% OFF`
    : `৳${offer!.discount_value.toLocaleString()} OFF`;
}

export default function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { addItem, getItemQuantity, updateQuantity } = useCart();
  const navigate = useNavigate();
  const isCylinder = isLpgCylinder(product);
  const qty = isCylinder ? 0 : getItemQuantity(product.id);
  const TypeIcon = typeIcons[product.type];
  const details = [product.company_name, product.size, product.valve_size, product.valve_connection].filter(Boolean).join(' · ');
  const activeOffer = isActiveOffer(product.active_offer) ? product.active_offer : null;
  const offerLabel = getOfferLabel(activeOffer);
  const salePrice = getDiscountedPrice(product.price, activeOffer);
  const hasSale = Boolean(activeOffer && salePrice < product.price);

  if (compact) {
    return (
      <div
        className="bg-white rounded-xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 group"
        onClick={() => navigate(`/product/${product.id}`)}
      >
        <div className="relative h-28 sm:h-32 overflow-hidden bg-gray-100">
          <img
            src={product.image_url || 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {offerLabel && (
            <span className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              <Tag className="w-3 h-3" /> {offerLabel}
            </span>
          )}
          {product.is_bestseller && (
            <span className="absolute top-2 left-2 flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3" /> Best
            </span>
          )}
        </div>
        <div className="p-3">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2.25rem]">{product.name}</h3>
          {details && <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{details}</p>}
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-blue-600 font-bold text-sm">৳{salePrice.toLocaleString()}</p>
            {hasSale && <p className="text-[11px] text-gray-400 line-through">৳{product.price.toLocaleString()}</p>}
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500"><Truck className="w-3 h-3" /> {getDeliveryFeeLabel(product)}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 group h-full flex flex-col"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div className="relative h-36 sm:h-48 overflow-hidden bg-gray-100">
        <img
          src={product.image_url || 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${typeColors[product.type]}`}>
            <TypeIcon className="w-3 h-3" />
            {typeLabels[product.type]}
          </span>
          {product.is_bestseller && (
            <span className="flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              <Star className="w-3 h-3" /> Best Seller
            </span>
          )}
          {offerLabel && (
            <span className="flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
              <Tag className="w-3 h-3" /> {offerLabel}
            </span>
          )}
        </div>
        {product.size && (
          <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            {product.size}
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem] sm:min-h-0 leading-snug">{product.name}</h3>
        {details && <p className="text-xs text-blue-600 font-medium mt-1 line-clamp-1">{details}</p>}
        {product.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2 min-h-[2.5rem]">{product.description}</p>
        )}
        {activeOffer && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-600">
            <Tag className="w-3.5 h-3.5" /> {activeOffer.title}
          </p>
        )}
        {product.type !== 'service' && (
          <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><Truck className="w-3.5 h-3.5" /> {getDeliveryFeeLabel(product)}</p>
        )}
        <div className="mt-auto pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-bold text-blue-600">৳{salePrice.toLocaleString()}</span>
              {hasSale && <span className="text-sm text-gray-400 line-through">৳{product.price.toLocaleString()}</span>}
            </div>
            {product.unit !== 'piece' && (
              <span className="text-xs text-gray-400">/{product.unit}</span>
            )}
          </div>
          {qty > 0 ? (
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 bg-blue-50 sm:bg-transparent rounded-xl p-1 sm:p-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => updateQuantity(product.id, qty - 1)}
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-blue-100 text-blue-600 font-bold hover:bg-blue-200 transition-colors flex items-center justify-center"
              >
                -
              </button>
              <span className="flex-1 sm:flex-none sm:w-8 text-center font-semibold text-gray-900">{qty}</span>
              <button
                onClick={() => updateQuantity(product.id, qty + 1)}
                className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={e => {
                e.stopPropagation();
                if (isCylinder) {
                  navigate(`/product/${product.id}`);
                  return;
                }
                addItem(hasSale ? { ...product, price: salePrice } : product);
              }}
              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all hover:shadow-md whitespace-nowrap"
            >
              <ShoppingCart className="w-4 h-4" />
              {isCylinder ? 'Select' : 'Add'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

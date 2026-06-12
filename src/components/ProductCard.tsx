import { Product } from '../lib/types';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Star, Flame, RotateCcw, Wrench } from 'lucide-react';

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

export default function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { addItem, getItemQuantity, updateQuantity } = useCart();
  const navigate = useNavigate();
  const qty = getItemQuantity(product.id);
  const TypeIcon = typeIcons[product.type];
  const details = [product.company_name, product.size, product.valve_size, product.valve_connection].filter(Boolean).join(' · ');

  if (compact) {
    return (
      <div
        className="bg-white rounded-xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 group"
        onClick={() => navigate(`/product/${product.id}`)}
      >
        <div className="relative h-32 overflow-hidden bg-gray-100">
          <img
            src={product.image_url || 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {product.is_bestseller && (
            <span className="absolute top-2 left-2 flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3" /> Best
            </span>
          )}
        </div>
        <div className="p-3">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{product.name}</h3>
          {details && <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{details}</p>}
          <p className="text-blue-600 font-bold text-sm mt-1">৳{product.price.toLocaleString()}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 group"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div className="relative h-48 overflow-hidden bg-gray-100">
        <img
          src={product.image_url || 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=400'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${typeColors[product.type]}`}>
            <TypeIcon className="w-3 h-3" />
            {typeLabels[product.type]}
          </span>
          {product.is_bestseller && (
            <span className="flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              <Star className="w-3 h-3" /> Best Seller
            </span>
          )}
        </div>
        {product.size && (
          <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            {product.size}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
        {details && <p className="text-xs text-blue-600 font-medium mt-1 line-clamp-1">{details}</p>}
        {product.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="text-xl font-bold text-blue-600">৳{product.price.toLocaleString()}</span>
            {product.unit !== 'piece' && (
              <span className="text-xs text-gray-400 ml-1">/{product.unit}</span>
            )}
          </div>
          {qty > 0 ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => updateQuantity(product.id, qty - 1)}
                className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 font-bold hover:bg-blue-200 transition-colors flex items-center justify-center"
              >
                -
              </button>
              <span className="w-8 text-center font-semibold text-gray-900">{qty}</span>
              <button
                onClick={() => updateQuantity(product.id, qty + 1)}
                className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); addItem(product); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all hover:shadow-md"
            >
              <ShoppingCart className="w-4 h-4" />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

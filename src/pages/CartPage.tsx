import { useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { FLOOR_CHARGE_PER_FLOOR } from '../lib/constants';
import { calculateCartDeliveryFee, getDeliveryFeeLabel, getProductDeliveryFee, isLpgCylinder } from '../lib/deliveryCharges';
import {
  ShoppingCart, Trash2, Plus, Minus,
  MapPin, ArrowRight, Tag, X, Check, Building2
} from 'lucide-react';

export default function CartPage() {
  const {
    items, updateQuantity, removeItem, totalPrice,
    promoCode, appliedOffer, promoError, applyPromo, removePromo, discountAmount,
  } = useCart();
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState('');

  // Floor preview (default ground floor; user picks exact floor at checkout)
  const cylinderItems = items.filter(i => isLpgCylinder(i.product));
  const totalCylinderQty = cylinderItems.reduce((s, i) => s + i.quantity, 0);
  const hasCylinders = totalCylinderQty > 0;

  const subtotal = totalPrice;
  const discount = discountAmount;
  const afterDiscount = subtotal - discount;
  const deliveryFee = calculateCartDeliveryFee(items);
  const firstNonCylinderCartKey = items.find((item) => !isLpgCylinder(item.product))?.cart_key;
  const estimatedTotal = afterDiscount + deliveryFee;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-10 h-10 text-blue-300" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6">Add some cylinders and products to get started</p>
          <button
            onClick={() => navigate('/products')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Shopping Cart</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map(({ cart_key, product, quantity, selected_valve_size, selected_valve_connection }) => (
              <div
                key={cart_key}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4"
              >
                <div
                  className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <img
                    src={product.image_url || 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=200'}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    {product.name}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {product.size && (
                      <span className="text-xs text-gray-500">{product.size}</span>
                    )}
                    {selected_valve_connection && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">Valve: {selected_valve_connection}</span>
                    )}
                    {selected_valve_size && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">{selected_valve_size}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    ৳{product.price.toLocaleString()} x {quantity}
                  </p>
                  {product.type !== 'service' && (
                    <p className="text-xs text-gray-500 mt-1">{getDeliveryFeeLabel(product)} x {quantity}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(cart_key, quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-semibold text-sm">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(cart_key, quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-blue-600">৳{(product.price * quantity).toLocaleString()}</span>
                      <button
                        onClick={() => removeItem(cart_key)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Promo Code */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-gray-900">Promo Code</h3>
              </div>

              {appliedOffer ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="font-mono font-bold text-green-700 tracking-widest text-sm">{promoCode}</span>
                    <span className="text-green-600 text-sm font-semibold">
                      — {appliedOffer.discount_type === 'percentage'
                        ? `${appliedOffer.discount_value}% off`
                        : `৳${appliedOffer.discount_value} off`}
                    </span>
                  </div>
                  <button
                    onClick={removePromo}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={e => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && applyPromo(promoInput)}
                      placeholder="Enter promo code"
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                    />
                    <button
                      onClick={() => applyPromo(promoInput)}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all flex-shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                  {promoError && (
                    <p className="text-red-500 text-xs mt-2">{promoError}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-20">
              <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-3 text-sm">
                {/* Itemized product prices */}
                <div className="space-y-1.5">
                  {items.map(({ cart_key, product, quantity, selected_valve_size, selected_valve_connection }) => {
                    const isCylinder = isLpgCylinder(product);
                    const showDeliveryLine = isCylinder || (!hasCylinders && cart_key === firstNonCylinderCartKey);
                    const lineDeliveryFee = isCylinder ? getProductDeliveryFee(product) * quantity : deliveryFee;
                    return (
                      <div key={cart_key} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500 truncate mr-2">{product.name}{selected_valve_connection ? ` · ${selected_valve_connection}` : ''}{selected_valve_size ? ` · ${selected_valve_size}` : ''} x{quantity}</span>
                          <span className="font-medium text-gray-900 flex-shrink-0">৳{(product.price * quantity).toLocaleString()}</span>
                        </div>
                        {showDeliveryLine && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">{isCylinder ? `${getDeliveryFeeLabel(product)} x${quantity}` : 'Regular delivery charge'}</span>
                            <span className="text-gray-500">৳{lineDeliveryFee.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="text-gray-700 font-semibold">Subtotal</span>
                  <span className="font-semibold text-gray-900">৳{subtotal.toLocaleString()}</span>
                </div>

                {/* Discount */}
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-green-600 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> Discount ({promoCode})
                    </span>
                    <span className="font-semibold text-green-600">-৳{discount.toLocaleString()}</span>
                  </div>
                )}

                {/* Delivery fee */}
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1">
                    Delivery Fee
                  </span>
                  <span className="font-medium text-gray-900">৳{deliveryFee}</span>
                </div>

                {/* Floor charge note */}
                {hasCylinders && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> Floor Charge
                    </span>
                    <span className="text-xs text-gray-400">At checkout</span>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="font-bold text-gray-900">Estimated Total</span>
                  <span className="font-bold text-blue-600 text-lg">৳{estimatedTotal.toLocaleString()}</span>
                </div>

                {hasCylinders && (
                  <p className="text-xs text-gray-400">
                    + floor charge (৳{FLOOR_CHARGE_PER_FLOOR}/floor/cylinder above ground floor, selected at checkout)
                  </p>
                )}
              </div>

              <button
                onClick={() => navigate('/checkout')}
                className="w-full mt-5 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/addresses')}
                className="w-full mt-3 py-3 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" /> Set Delivery Address
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

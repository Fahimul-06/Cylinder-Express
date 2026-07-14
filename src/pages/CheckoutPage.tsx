import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { Address } from '../lib/types';
import { FLOORS, FLOOR_CHARGE_PER_FLOOR } from '../lib/constants';
import { calculateCartDeliveryFee, getDeliveryFeeLabel, getProductDeliveryFee, isLpgCylinder } from '../lib/deliveryCharges';
import {
  MapPin, ChevronRight, Check, ShoppingBag,
  Truck, CreditCard, Building2, Info, Tag, Phone, ShieldCheck
} from 'lucide-react';

export default function CheckoutPage() {
  const { user, profile, updateProfile } = useAuth();
  const { items, totalPrice, clearCart, appliedOffer, promoCode, discountAmount, eligibleItemsForDiscount } = useCart();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [phoneSavedForOrder, setPhoneSavedForOrder] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const cylinderItems = useMemo(
    () => items.filter(i => isLpgCylinder(i.product)),
    [items]
  );
  const totalCylinderQty = cylinderItems.reduce((s, i) => s + i.quantity, 0);
  const hasCylinders = totalCylinderQty > 0;

  const floorsAboveGround = selectedFloor - 1;
  const floorCharge = hasCylinders ? floorsAboveGround * FLOOR_CHARGE_PER_FLOOR * totalCylinderQty : 0;

  const subtotal = totalPrice;
  const discount = discountAmount;
  const afterDiscount = subtotal - discount;
  const deliveryFee = calculateCartDeliveryFee(items);
  const firstNonCylinderCartKey = items.find((item) => !isLpgCylinder(item.product))?.cart_key;
  const grandTotal = afterDiscount + deliveryFee + floorCharge;

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    async function fetchAddresses() {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });
      if (data && data.length > 0) {
        setAddresses(data);
        const def = data.find((a: any) => a.is_default) || data[0];
        setSelectedAddress(def);
      }
      setLoading(false);
    }
    fetchAddresses();
  }, [user]);


  useEffect(() => {
    if (profile?.phone && isRealCustomerPhone(profile.phone)) {
      setPhoneInput(formatBangladeshPhone(profile.phone));
      setPhoneSavedForOrder(true);
    }
  }, [profile?.phone]);

  const customerHasPhone = phoneSavedForOrder || isRealCustomerPhone(profile?.phone);

  const normalizeCustomerPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('880') && digits.length === 13) return `0${digits.slice(3)}`;
    if (digits.startsWith('0') && digits.length === 11) return digits;
    return digits;
  };

  async function sendPhoneOtp() {
    const cleaned = normalizeCustomerPhone(phoneInput);
    if (!/^01[3-9]\d{8}$/.test(cleaned)) {
      setPhoneError('Enter a valid Bangladesh phone number, for example 017XXXXXXXX.');
      return;
    }
    setPhoneSaving(true);
    setPhoneError('');
    try {
      const res = await fetch(`${API_BASE_URL}/functions/v1/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to send OTP.');
      setPhoneInput(cleaned);
      setPhoneOtpSent(true);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : 'Failed to send OTP. Please try again.');
    } finally {
      setPhoneSaving(false);
    }
  }

  async function verifyAndSavePhone() {
    const cleaned = normalizeCustomerPhone(phoneInput);
    if (!/^01[3-9]\d{8}$/.test(cleaned)) {
      setPhoneError('Enter a valid Bangladesh phone number.');
      return;
    }
    if (!/^\d{6}$/.test(phoneOtp.trim())) {
      setPhoneError('Enter the 6-digit OTP sent to your phone.');
      return;
    }
    setPhoneSaving(true);
    setPhoneError('');
    try {
      const verifyRes = await fetch(`${API_BASE_URL}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned, otp: phoneOtp.trim() }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || verifyData.error) throw new Error(verifyData.error || 'Invalid OTP.');

      const { error } = await updateProfile({ phone: cleaned });
      if (error) throw new Error(error);

      setPhoneSavedForOrder(true);
      setPhoneModalOpen(false);
      setPhoneOtp('');
      setPhoneOtpSent(false);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : 'Could not save phone number.');
    } finally {
      setPhoneSaving(false);
    }
  }

  async function startInitialLocationShare(orderId: string) {
    if (!user || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const now = new Date().toISOString();
        const payload = {
          user_id: user.id,
          active_order_id: orderId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || null,
          is_sharing: true,
          last_seen: now,
          updated_at: now,
        };
        await supabase.from('customer_locations').upsert(payload, { onConflict: 'user_id' });
        await supabase.from('customer_location_points').insert({
          user_id: user.id,
          order_id: orderId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || null,
          recorded_at: now,
        });
      },
      () => {
        // Browser location permission is controlled by the customer device. The Orders page will ask again if needed.
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );
  }

  const handlePlaceOrder = async () => {
    if (!user || !selectedAddress || items.length === 0) return;
    if (!customerHasPhone) {
      setPhoneModalOpen(true);
      setPhoneError('Please add and verify your phone number before placing an order.');
      return;
    }
    setPlacing(true);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        address_id: selectedAddress.id,
        total_amount: subtotal,
        delivery_fee: deliveryFee,
        floor_number: hasCylinders ? selectedFloor : null,
        floor_charge: floorCharge,
        promo_code: promoCode || null,
        discount_amount: discount,
        notes: notes || null,
      })
      .select()
      .maybeSingle();

    if (orderError) {
      const message = orderError.message || 'Could not place order.';
      if (message.toLowerCase().includes('phone')) {
        setPhoneModalOpen(true);
        setPhoneError(message);
      }
      setPlacing(false);
      return;
    }

    if (order) {
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        selected_order_type: item.selected_order_type || null,
        selected_valve_size: item.selected_valve_size || null,
        selected_valve_connection: item.selected_valve_connection || null,
      }));
      await supabase.from('order_items').insert(orderItems);
      await startInitialLocationShare(order.id);
      clearCart();
      setOrderPlaced(true);
    }
    setPlacing(false);
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h2>
          <p className="text-gray-500 mb-8">Your order has been confirmed and will be delivered soon.</p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/orders')}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" /> View Orders
            </button>
            <button
              onClick={() => navigate('/home')}
              className="w-full py-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">

            {!customerHasPhone && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-900">Phone number required</h3>
                      <p className="text-sm text-amber-700 mt-1">
                        Your account was created with social login. Please add and verify your phone number before placing an order.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPhoneModalOpen(true)}
                    className="px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 whitespace-nowrap"
                  >
                    Add Phone
                  </button>
                </div>
              </div>
            )}

            {/* Delivery Address */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-gray-900">Delivery Address</h3>
                </div>
                <button
                  onClick={() => navigate('/addresses')}
                  className="text-blue-600 text-sm font-semibold flex items-center gap-1"
                >
                  Manage <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {loading ? (
                <div className="animate-pulse h-16 bg-gray-100 rounded-xl" />
              ) : addresses.length > 0 ? (
                <div className="space-y-2">
                  {addresses.map(addr => (
                    <button
                      key={addr.id}
                      onClick={() => setSelectedAddress(addr)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedAddress?.id === addr.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mb-1 ${
                            addr.label === 'Home' ? 'bg-blue-100 text-blue-700' :
                            addr.label === 'Office' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {addr.label}
                          </span>
                          <p className="text-sm font-medium text-gray-900">{addr.address_line1}</p>
                          {addr.address_line2 && <p className="text-sm text-gray-500">{addr.address_line2}</p>}
                          <p className="text-xs text-gray-400 mt-1">{addr.area && `${addr.area}, `}{addr.city}{addr.district && `, ${addr.district}`}</p>
                        </div>
                        {selectedAddress?.id === addr.id && (
                          <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm mb-3">No saved addresses</p>
                  <button
                    onClick={() => navigate('/addresses')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
                  >
                    Add Address
                  </button>
                </div>
              )}
            </div>

            {/* Floor Selection */}
            {hasCylinders && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-gray-900">Delivery Floor</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Which floor should we deliver your cylinder{totalCylinderQty > 1 ? 's' : ''} to?
                </p>

                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Ground floor delivery is free. Each floor above ground adds{' '}
                    <strong>৳{FLOOR_CHARGE_PER_FLOOR}</strong> per cylinder (
                    {totalCylinderQty} cylinder{totalCylinderQty > 1 ? 's' : ''} &times; floor surcharge).
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {FLOORS.map(floor => {
                    const charge = floor.charge * totalCylinderQty;
                    const isSelected = selectedFloor === floor.value;
                    return (
                      <button
                        key={floor.value}
                        onClick={() => setSelectedFloor(floor.value)}
                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-blue-200 hover:bg-blue-50/50'
                        }`}
                      >
                        <span>{floor.value === 1 ? 'GF' : `${floor.value}F`}</span>
                        <span className={`text-xs font-normal ${isSelected ? 'text-orange-600' : 'text-gray-400'}`}>
                          {charge === 0 ? 'Free' : `+৳${charge}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {floorCharge > 0 && (
                  <div className="mt-3 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm">
                    <span className="text-gray-700">
                      Floor surcharge ({selectedFloor}{getOrdinal(selectedFloor)} floor &times; {totalCylinderQty} cylinder{totalCylinderQty > 1 ? 's' : ''})
                    </span>
                    <span className="font-bold text-blue-600">+৳{floorCharge}</span>
                  </div>
                )}
              </div>
            )}

            {/* Applied Promo */}
            {appliedOffer && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-green-600" />
                    <span className="font-mono font-bold text-green-700 tracking-widest text-sm">{promoCode}</span>
                    <span className="text-green-600 text-sm font-semibold">
                      applied — {appliedOffer.discount_type === 'percentage'
                        ? `${appliedOffer.discount_value}% off`
                        : `৳${appliedOffer.discount_value} off`}
                    </span>
                  </div>
                  <span className="font-bold text-green-700">-৳{discount.toLocaleString()}</span>
                </div>
                {(appliedOffer.category_slug || appliedOffer.product_id) && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {appliedOffer.category_slug
                      ? `Valid for ${appliedOffer.category_slug.replace(/-/g, ' ')} items only`
                      : 'Valid for specific product only'}
                    ({eligibleItemsForDiscount.length} item{eligibleItemsForDiscount.length !== 1 ? 's' : ''} eligible)
                  </p>
                )}
              </div>
            )}

            {/* Order Items */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-gray-900">Order Items</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {items.map(({ cart_key, product, quantity, selected_valve_size, selected_valve_connection, selected_order_type }) => (
                  <div key={cart_key} className="flex items-center gap-3 py-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={product.image_url || 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=100'}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      {(selected_order_type || selected_valve_connection || selected_valve_size) && (
                        <p className="text-xs text-blue-600 font-semibold">
                          {selected_order_type && (selected_order_type === 'new' ? 'New Cylinder' : 'Refill')}
                          {selected_order_type && (selected_valve_connection || selected_valve_size) ? ' · ' : ''}
                          {selected_valve_connection && `Valve: ${selected_valve_connection}`}
                          {selected_valve_connection && selected_valve_size ? ' · ' : ''}
                          {selected_valve_size}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">৳{product.price.toLocaleString()} &times; {quantity}</p>
                    </div>
                    <span className="font-semibold text-sm text-gray-900">৳{(product.price * quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any special instructions for delivery..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none"
              />
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-20">
              <h3 className="font-bold text-gray-900 mb-4">Payment Summary</h3>
              <div className="space-y-3 text-sm">
                {/* Itemized prices */}
                <div className="space-y-1.5">
                  {items.map(({ cart_key, product, quantity, selected_valve_size, selected_valve_connection, selected_order_type }) => {
                    const isCylinder = isLpgCylinder(product);
                    const showDeliveryLine = isCylinder || (!hasCylinders && cart_key === firstNonCylinderCartKey);
                    const lineDeliveryFee = isCylinder ? getProductDeliveryFee(product) * quantity : deliveryFee;
                    return (
                      <div key={cart_key} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500 truncate mr-2">{product.name}{selected_order_type ? ` · ${selected_order_type === 'new' ? 'New' : 'Refill'}` : ''}{selected_valve_connection ? ` · ${selected_valve_connection}` : ''}{selected_valve_size ? ` · ${selected_valve_size}` : ''} &times;{quantity}</span>
                          <span className="font-medium text-gray-900 flex-shrink-0">৳{(product.price * quantity).toLocaleString()}</span>
                        </div>
                        {showDeliveryLine && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">{isCylinder ? `${getDeliveryFeeLabel(product)} ×${quantity}` : 'Regular delivery charge'}</span>
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

                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-green-600 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> Discount ({promoCode})
                    </span>
                    <span className="font-semibold text-green-600">-৳{discount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Delivery
                  </span>
                  <span className="font-medium">৳{deliveryFee}</span>
                </div>

                {hasCylinders && floorCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> Floor charge ({selectedFloor}{getOrdinal(selectedFloor)} fl.)
                    </span>
                    <span className="font-medium text-amber-600">৳{floorCharge}</span>
                  </div>
                )}
                {hasCylinders && floorCharge === 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> Floor charge
                    </span>
                    <span className="font-medium text-green-600">Free (Ground)</span>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-blue-600 text-lg">৳{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={placing || !selectedAddress}
                className="w-full mt-5 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                {placing ? 'Placing Order...' : customerHasPhone ? `Place Order - ৳${grandTotal.toLocaleString()}` : 'Add Phone Number to Order'}
              </button>

              {!selectedAddress && (
                <p className="text-xs text-red-500 mt-2 text-center">Please select a delivery address</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {phoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add phone number</h2>
                <p className="text-sm text-gray-500 mt-1">
                  We need a verified phone number so HUB staff and support can contact you about this order.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <input
                  value={phoneInput}
                  onChange={(e) => { setPhoneInput(e.target.value); setPhoneOtpSent(false); setPhoneOtp(''); setPhoneError(''); }}
                  placeholder="017XXXXXXXX"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              {phoneOtpSent && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">OTP Code</label>
                  <input
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              )}

              {phoneError && <p className="text-sm text-red-600">{phoneError}</p>}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => { setPhoneModalOpen(false); setPhoneError(''); }}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                {!phoneOtpSent ? (
                  <button
                    type="button"
                    onClick={sendPhoneOtp}
                    disabled={phoneSaving}
                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {phoneSaving ? 'Sending...' : 'Send OTP'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={verifyAndSavePhone}
                    disabled={phoneSaving}
                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {phoneSaving ? 'Saving...' : 'Verify & Continue'}
                  </button>
                )}
              </div>

              {phoneOtpSent && (
                <button
                  type="button"
                  onClick={sendPhoneOtp}
                  disabled={phoneSaving}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isRealCustomerPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const value = String(phone).trim();
  if (!value || value.includes(':') || value.includes('@')) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('880')) return /^8801[3-9]\d{8}$/.test(digits);
  return /^01[3-9]\d{8}$/.test(digits);
}

function formatBangladeshPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return `0${digits.slice(3)}`;
  return digits;
}

function getOrdinal(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

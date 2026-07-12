import { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { CartItem, Offer, Product } from '../lib/types';
import { useAuth } from './AuthContext';

export interface CartItemOptions {
  valve_size?: string | null;
  valve_connection?: string | null;
  order_type?: 'new' | 'refill' | null;
}

export function buildCartItemKey(productId: string, options?: CartItemOptions) {
  const valveSize = options?.valve_size || '';
  const valveConnection = options?.valve_connection || '';
  const orderType = options?.order_type || '';
  if (!valveSize && !valveConnection && !orderType) return productId;
  return `${productId}::${orderType}::${valveSize}::${valveConnection}`;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, options?: CartItemOptions) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getItemQuantity: (productId: string, options?: CartItemOptions) => number;
  promoCode: string;
  appliedOffer: Offer | null;
  promoError: string;
  applyPromo: (code: string) => Promise<void>;
  removePromo: () => void;
  discountAmount: number;
  eligibleItemsForDiscount: CartItem[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function normalizePromoCategorySlug(slug?: string | null) {
  const aliases: Record<string, string> = {
    cylinders: 'lpg-cylinders',
    stoves: 'stoves-burners',
    installation: 'services',
  };
  return aliases[slug || ''] || slug || '';
}

function itemMatchesOffer(item: CartItem, offer: Offer) {
  if (offer.product_id) return item.product.id === offer.product_id;
  if (offer.category_slug) {
    const offerCategory = normalizePromoCategorySlug(offer.category_slug);
    const categorySlug = normalizePromoCategorySlug(item.product.category?.slug || '');
    const categoryId = normalizePromoCategorySlug(item.product.category_id || '');
    return categorySlug === offerCategory || categoryId === offerCategory;
  }
  return true;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedOffer, setAppliedOffer] = useState<Offer | null>(null);
  const [promoError, setPromoError] = useState('');

  const addItem = (product: Product, quantity = 1, options?: CartItemOptions) => {
    const cartKey = buildCartItemKey(product.id, options);
    const productForCart: Product = {
      ...product,
      valve_size: options?.valve_size ?? product.valve_size ?? null,
      valve_connection: options?.valve_connection ?? product.valve_connection ?? null,
      type: options?.order_type ?? product.type,
    };

    setItems(prev => {
      const existing = prev.find(i => i.cart_key === cartKey);
      if (existing) {
        return prev.map(i =>
          i.cart_key === cartKey
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, {
        cart_key: cartKey,
        product: productForCart,
        quantity,
        selected_valve_size: options?.valve_size ?? null,
        selected_valve_connection: options?.valve_connection ?? null,
        selected_order_type: options?.order_type ?? null,
      }];
    });
  };

  const removeItem = (cartKey: string) => {
    setItems(prev => prev.filter(i => i.cart_key !== cartKey));
  };

  const updateQuantity = (cartKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartKey);
      return;
    }
    setItems(prev =>
      prev.map(i => (i.cart_key === cartKey ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedOffer(null);
    setPromoCode('');
    setPromoError('');
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  // Determine which items are eligible for the promo discount
  const eligibleItemsForDiscount = useMemo(() => {
    if (!appliedOffer) return [];

    return items.filter(item => itemMatchesOffer(item, appliedOffer));
  }, [items, appliedOffer]);

  // Calculate discount only on eligible items
  const eligibleTotal = eligibleItemsForDiscount.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );

  const discountAmount = appliedOffer
    ? appliedOffer.discount_type === 'percentage'
      ? Math.round(eligibleTotal * (appliedOffer.discount_value / 100))
      : Math.min(appliedOffer.discount_value, eligibleTotal)
    : 0;

  const applyPromo = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setPromoError('Please enter a promo code');
      return;
    }
    setPromoError('');
    const { data } = await supabase
      .from('offers')
      .select('*')
      .eq('code', trimmed)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) {
      setPromoError('Invalid or expired promo code');
      setAppliedOffer(null);
      setPromoCode('');
      return;
    }
    if (data.valid_until && new Date(data.valid_until) < new Date()) {
      setPromoError('This promo code has expired');
      setAppliedOffer(null);
      setPromoCode('');
      return;
    }

    const offer = data as Offer;

    if (offer.product_id) {
      setPromoError('Sale product discounts are applied automatically. Promo codes are only for special offers.');
      setAppliedOffer(null);
      setPromoCode('');
      return;
    }

    if (user?.id) {
      const maxUses = Math.max(1, Number(offer.max_uses_per_customer || 1));
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('promo_code', trimmed);

      if ((count || 0) >= maxUses) {
        setPromoError(maxUses === 1
          ? 'You have already used this promo code.'
          : `You have already used this promo code ${maxUses} times.`);
        setAppliedOffer(null);
        setPromoCode('');
        return;
      }
    }

    // Check if cart has eligible items for this offer
    const hasEligibleItems = items.some(item => itemMatchesOffer(item, offer));

    if (!hasEligibleItems) {
      let message = 'This promo code is not applicable to items in your cart.';
      if (offer.category_slug) {
        message = `This promo code only applies to ${offer.category_slug.replace(/-/g, ' ')} products.`;
      } else if (offer.product_id) {
        message = 'This promo code only applies to a specific product not in your cart.';
      }
      setPromoError(message);
      setAppliedOffer(null);
      setPromoCode('');
      return;
    }

    setAppliedOffer(offer);
    setPromoCode(trimmed);
  };

  const removePromo = () => {
    setAppliedOffer(null);
    setPromoCode('');
    setPromoError('');
  };

  const getItemQuantity = (productId: string, options?: CartItemOptions) => {
    if (options) {
      const cartKey = buildCartItemKey(productId, options);
      const item = items.find(i => i.cart_key === cartKey);
      return item?.quantity ?? 0;
    }
    return items
      .filter(i => i.product.id === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQuantity, clearCart,
      totalItems, totalPrice, getItemQuantity,
      promoCode, appliedOffer, promoError, applyPromo, removePromo, discountAmount,
      eligibleItemsForDiscount,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}

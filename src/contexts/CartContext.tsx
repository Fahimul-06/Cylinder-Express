import { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { CartItem, Offer, Product } from '../lib/types';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getItemQuantity: (productId: string) => number;
  promoCode: string;
  appliedOffer: Offer | null;
  promoError: string;
  applyPromo: (code: string) => Promise<void>;
  removePromo: () => void;
  discountAmount: number;
  eligibleItemsForDiscount: CartItem[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedOffer, setAppliedOffer] = useState<Offer | null>(null);
  const [promoError, setPromoError] = useState('');

  const addItem = (product: Product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems(prev =>
      prev.map(i => (i.product.id === productId ? { ...i, quantity } : i))
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

    return items.filter(item => {
      // If offer is for a specific product, only that product qualifies
      if (appliedOffer.product_id) {
        return item.product.id === appliedOffer.product_id;
      }
      // If offer is for a category, only items in that category qualify
      if (appliedOffer.category_slug) {
        return item.product.category?.slug === appliedOffer.category_slug;
      }
      // If no product_id or category_slug, offer applies to all items
      return true;
    });
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

    // Check if cart has eligible items for this offer
    const hasEligibleItems = items.some(item => {
      if (data.product_id) {
        return item.product.id === data.product_id;
      }
      if (data.category_slug) {
        return item.product.category?.slug === data.category_slug;
      }
      return true;
    });

    if (!hasEligibleItems) {
      let message = 'This promo code is not applicable to items in your cart.';
      if (data.category_slug) {
        message = `This promo code only applies to ${data.category_slug.replace(/-/g, ' ')} products.`;
      } else if (data.product_id) {
        message = 'This promo code only applies to a specific product not in your cart.';
      }
      setPromoError(message);
      setAppliedOffer(null);
      setPromoCode('');
      return;
    }

    setAppliedOffer(data);
    setPromoCode(trimmed);
  };

  const removePromo = () => {
    setAppliedOffer(null);
    setPromoCode('');
    setPromoError('');
  };

  const getItemQuantity = (productId: string) => {
    const item = items.find(i => i.product.id === productId);
    return item?.quantity ?? 0;
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

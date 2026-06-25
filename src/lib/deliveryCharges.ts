import { CartItem, Product } from './types';

export const LPG_CYLINDER_DELIVERY_FEE = 100;
export const OTHER_PRODUCT_DELIVERY_FEE = 70;

export function parseKgSize(size?: string | null): number | null {
  if (!size) return null;
  const match = String(size).toLowerCase().match(/(\d+(?:\.\d+)?)\s*kg/);
  return match ? Number(match[1]) : null;
}

export function isLpgCylinder(product: Product): boolean {
  const categorySlug = product.category?.slug?.toLowerCase() || '';
  const unit = product.unit?.toLowerCase() || '';
  return categorySlug === 'lpg-cylinders' || unit === 'cylinder' || Boolean(product.company_name && parseKgSize(product.size) !== null);
}

export function getCylinderDeliveryFee(): number {
  return LPG_CYLINDER_DELIVERY_FEE;
}

export function getProductDeliveryFee(product: Product): number {
  return isLpgCylinder(product) ? LPG_CYLINDER_DELIVERY_FEE : OTHER_PRODUCT_DELIVERY_FEE;
}

export function calculateCartDeliveryFee(items: CartItem[]): number {
  const lpgQuantity = items.reduce((sum, item) => {
    if (!isLpgCylinder(item.product)) return sum;
    return sum + item.quantity;
  }, 0);

  if (lpgQuantity > 0) {
    return lpgQuantity * LPG_CYLINDER_DELIVERY_FEE;
  }

  const hasServiceOrAccessory = items.some((item) => !isLpgCylinder(item.product));
  return hasServiceOrAccessory ? OTHER_PRODUCT_DELIVERY_FEE : 0;
}

export function getDeliveryFeeLabel(product: Product): string {
  if (isLpgCylinder(product)) {
    return `Delivery ৳${LPG_CYLINDER_DELIVERY_FEE} per cylinder`;
  }
  return `Delivery ৳${OTHER_PRODUCT_DELIVERY_FEE}`;
}

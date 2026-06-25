import { CartItem, Product } from './types';

export const OTHER_PRODUCT_DELIVERY_FEE = 0;

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

export function getCylinderDeliveryFeeBySize(size?: string | null): number {
  const kg = parseKgSize(size);
  if (kg === null) return 100;
  if (kg <= 12.5) return 100;
  // 15kg and 20kg are handled between the user-provided bands so they do not fall back to accessory delivery.
  if (kg < 22) return 150;
  if (kg <= 30) return 200;
  if (kg <= 35) return 250;
  return 300;
}

export function getProductDeliveryFee(product: Product): number {
  // Delivery charge applies only to LPG cylinders.
  // Services, accessories, stoves, regulators, pipes, and all other non-cylinder products have no extra delivery charge.
  if (isLpgCylinder(product)) return getCylinderDeliveryFeeBySize(product.size);
  return 0;
}

export function calculateCartDeliveryFee(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    if (!isLpgCylinder(item.product)) return sum;
    return sum + getCylinderDeliveryFeeBySize(item.product.size) * item.quantity;
  }, 0);
}

export function getDeliveryFeeLabel(product: Product): string {
  if (isLpgCylinder(product)) {
    return `Delivery ৳${getCylinderDeliveryFeeBySize(product.size)}`;
  }
  return 'No delivery charge';
}

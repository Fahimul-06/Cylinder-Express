import { Product } from './types';
import { isLpgCylinder } from './deliveryCharges';

export function getCylinderGasPrice(product: Product): number {
  if (!isLpgCylinder(product)) return Number(product.price || 0);
  return Number(product.gas_price ?? product.price ?? 0);
}

export function getCylinderBottlePrice(product: Product): number {
  if (!isLpgCylinder(product)) return 0;
  return Number(product.bottle_price ?? 0);
}

export function getProductPriceForOrderType(
  product: Product,
  orderType?: 'new' | 'refill' | null,
): number {
  if (!isLpgCylinder(product)) return Number(product.price || 0);
  const gasPrice = getCylinderGasPrice(product);
  return orderType === 'new' ? gasPrice + getCylinderBottlePrice(product) : gasPrice;
}

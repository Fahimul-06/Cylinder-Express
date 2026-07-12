import { Product } from './types';
import { isLpgCylinder } from './deliveryCharges';

function lpgCatalogKey(product: Product) {
  const company = (product.company_name || product.name || '').trim().toLowerCase();
  const size = (product.size || '').trim().toLowerCase();
  return `${company}::${size}`;
}

function preferenceScore(product: Product) {
  return (Number(product.bottle_price || 0) > 0 ? 100 : 0)
    + (Number(product.gas_price || 0) > 0 ? 20 : 0)
    + (product.type === 'new' ? 5 : 0)
    + (product.is_bestseller ? 1 : 0);
}

/** Show each LPG company + size only once in customer-facing catalog sections. */
export function dedupeCustomerProducts(products: Product[]) {
  const seen = new Map<string, Product>();
  const regular: Product[] = [];

  for (const product of products) {
    if (!isLpgCylinder(product)) {
      regular.push(product);
      continue;
    }

    const key = lpgCatalogKey(product);
    const current = seen.get(key);
    if (!current || preferenceScore(product) > preferenceScore(current)) {
      seen.set(key, product);
    }
  }

  return [...seen.values(), ...regular].sort((a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
  );
}

export function getLpgDisplayName(product: Product) {
  if (!isLpgCylinder(product)) return product.name;
  return [product.company_name, product.size, 'LPG Cylinder'].filter(Boolean).join(' ');
}

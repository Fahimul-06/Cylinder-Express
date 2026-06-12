import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Product, Category, SortOption, TypeFilter } from '../lib/types';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import {
  Search, SlidersHorizontal, X, ChevronDown,
  Flame, RotateCcw, Wrench, Package
} from 'lucide-react';

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortOption>('name-asc');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || 'all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('*, category:categories(*)').eq('is_available', true).order('sort_order'),
        supabase.from('categories').select('*').order('sort_order'),
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const sortProducts = (items: Product[]) => [...items].sort((a, b) => {
    switch (sort) {
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'price-asc': return a.price - b.price;
      case 'price-desc': return b.price - a.price;
      case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default: return 0;
    }
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = [...products];

    if (q) {
      result = result.filter(p =>
        [p.name, p.description, p.size, p.type, p.category?.name, p.company_name, p.valve_size, p.valve_connection]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(q))
      );
    }

    if (typeFilter !== 'all') result = result.filter(p => p.type === typeFilter);
    if (categoryFilter !== 'all') result = result.filter(p => p.category?.slug === categoryFilter);
    if (searchParams.get('bestseller') === 'true') result = result.filter(p => p.is_bestseller);

    return sortProducts(result);
  }, [products, search, sort, typeFilter, categoryFilter, searchParams]);

  const sectionedProducts = useMemo(() => {
    return categories
      .filter(category => categoryFilter === 'all' || category.slug === categoryFilter)
      .map(category => {
        const q = (sectionSearch[category.slug] || '').trim().toLowerCase();
        const items = filtered.filter(p => {
          if (p.category?.slug !== category.slug) return false;
          if (!q) return true;
          return [p.name, p.description, p.size, p.company_name, p.valve_size, p.valve_connection]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(q));
        });
        return { category, items };
      })
      .filter(group => group.items.length > 0 || !search && !sectionSearch[group.category.slug]);
  }, [categories, categoryFilter, filtered, search, sectionSearch]);

  const typeFilters: { key: TypeFilter; label: string; icon: typeof Flame }[] = [
    { key: 'all', label: 'All', icon: Package },
    { key: 'new', label: 'New', icon: Flame },
    { key: 'refill', label: 'Refill', icon: RotateCcw },
    { key: 'service', label: 'Service', icon: Wrench },
  ];

  const clearFilters = () => {
    setSearch('');
    setSectionSearch({});
    setSort('name-asc');
    setTypeFilter('all');
    setCategoryFilter('all');
  };

  const hasActiveFilters = search || typeFilter !== 'all' || categoryFilter !== 'all' || Object.values(sectionSearch).some(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-200 rounded-xl" />
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Products & Services</h1>
          <span className="text-sm text-gray-500">{filtered.length} items</span>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company, cylinder size, valve, stove, burner, service..."
            className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {typeFilters.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                typeFilter === key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              showFilters ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            More
          </button>
        </div>

        {showFilters && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 space-y-4 animate-in slide-in-from-top">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Filters & Sort</h3>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-blue-600 text-sm font-medium hover:text-blue-700">
                  Clear All
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product / Service Box</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    categoryFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All Boxes
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.slug)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      categoryFilter === cat.slug ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <div className="relative">
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as SortOption)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="price-asc">Price (Low to High)</option>
                  <option value="price-desc">Price (High to Low)</option>
                  <option value="newest">Newest First</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {sectionedProducts.length > 0 ? (
          <div className="space-y-6">
            {sectionedProducts.map(({ category, items }) => {
              const Icon = category.slug === 'lpg-cylinders' ? Flame : category.slug === 'services' ? Wrench : Package;
              return (
                <section key={category.id} className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-blue-600" />
                      <div>
                        <h2 className="font-bold text-gray-900">{category.name}</h2>
                        <p className="text-xs text-gray-500">{items.length} available items</p>
                      </div>
                    </div>
                    <div className="relative sm:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        value={sectionSearch[category.slug] || ''}
                        onChange={e => setSectionSearch(prev => ({ ...prev, [category.slug]: e.target.value }))}
                        placeholder={`Search ${category.name.toLowerCase()}...`}
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </div>
                  </div>
                  {items.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                      {items.map(p => <ProductCard key={p.id} product={p} />)}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-gray-500">No items found in this box.</div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500 text-sm mb-4">Try adjusting your search or filters</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

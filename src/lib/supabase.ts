function resolveApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }

    // Render static frontend fallback:
    // cylinder-express-web.onrender.com -> cylinder-express-api.onrender.com
    if (hostname.endsWith('.onrender.com') && hostname.includes('-web.')) {
      return `${protocol}//${hostname.replace('-web.', '-api.')}`;
    }

    // If frontend and backend are served from the same origin, this works without env.
    return origin;
  }

  return 'http://localhost:5000';
}

export const API_BASE_URL = resolveApiBaseUrl();
const TOKEN_KEY = 'cylinder_express_auth_token';

type Filter = { field: string; op: 'eq' | 'in' | 'gte'; value: unknown };
type OrderBy = { field: string; ascending: boolean };

type ApiResult<T = unknown> = { data: T | null; error: { message: string } | null; count?: number | null };

export type User = { id: string; email?: string | null; phone?: string | null };
export type Session = { access_token: string; user: User };

type AuthListener = (event: string, session: Session | null) => void;
const listeners = new Set<AuthListener>();

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(options.headers || {}),
  } as Record<string, string>;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (_error) {
    throw new Error(
      `Cannot connect to Cylinder Express server. Check VITE_API_BASE_URL, backend Render service status, and CLIENT_ORIGIN. Current API: ${API_BASE_URL}`
    );
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || payload.message || 'Request failed');
  return payload as T;
}


export async function apiClient<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  return api<T>(path, options);
}

function emitAuth(event: string, session: Session | null) {
  listeners.forEach((listener) => listener(event, session));
}

class QueryBuilder implements PromiseLike<any> {
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private selectQuery = '*';
  private filters: Filter[] = [];
  private orderBy?: OrderBy;
  private limitValue?: number;
  private body?: unknown;
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';
  private countOption?: string;

  constructor(private table: string) {}

  select(query = '*', options?: { count?: string }) {
    this.action = this.action === 'select' ? 'select' : this.action;
    this.selectQuery = query;
    this.countOption = options?.count;
    return this;
  }

  insert(payload: unknown) { this.action = 'insert'; this.body = payload; return this; }
  update(payload: unknown) { this.action = 'update'; this.body = payload; return this; }
  upsert(payload: unknown, _options?: unknown) { this.action = 'upsert'; this.body = payload; return this; }
  delete() { this.action = 'delete'; return this; }
  eq(field: string, value: unknown) { this.filters.push({ field, op: 'eq', value }); return this; }
  in(field: string, value: unknown[]) { this.filters.push({ field, op: 'in', value }); return this; }
  gte(field: string, value: unknown) { this.filters.push({ field, op: 'gte', value }); return this; }
  order(field: string, options?: { ascending?: boolean }) { this.orderBy = { field, ascending: options?.ascending ?? true }; return this; }
  limit(value: number) { this.limitValue = value; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }

  private async execute(): Promise<ApiResult<any>> {
    try {
      const payload = await api<ApiResult<any>>(`/api/tables/${this.table}`, {
        method: 'POST',
        body: JSON.stringify({
          action: this.action,
          select: this.selectQuery,
          filters: this.filters,
          order: this.orderBy,
          limit: this.limitValue,
          body: this.body,
          single: this.singleMode,
          count: this.countOption,
        }),
      });
      return payload;
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Request failed' }, count: null };
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: ApiResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  rpc(name: string, args: Record<string, unknown>) {
    return api<ApiResult<any>>(`/api/rpc/${name}`,  { method: 'POST', body: JSON.stringify(args) })
      .catch((error) => ({ data: null, error: { message: error.message } }));
  },
  auth: {
    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string; phone?: string } } }) {
      try {
        const data = await api<{ session: Session; user: User }>('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, full_name: options?.data?.full_name, phone: options?.data?.phone }),
        });
        localStorage.setItem(TOKEN_KEY, data.session.access_token);
        emitAuth('SIGNED_IN', data.session);
        return { data, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : 'Sign up failed' } };
      }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        const data = await api<{ session: Session; user: User }>('/api/auth/signin', {
          method: 'POST',
          body: JSON.stringify({ emailOrPhone: email, password }),
        });
        localStorage.setItem(TOKEN_KEY, data.session.access_token);
        emitAuth('SIGNED_IN', data.session);
        return { data, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : 'Login failed' } };
      }
    },
    async signInAdmin({ email, password }: { email: string; password: string }) {
      try {
        const result = await api<{ session: Session }>('/api/auth/admin/signin', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        localStorage.setItem(TOKEN_KEY, result.session.access_token);
        emitAuth('SIGNED_IN', result.session);
        return { data: { user: result.session.user, session: result.session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: { message: error instanceof Error ? error.message : 'Admin login failed' } };
      }
    },

    async signInWithSocial({ provider, accessToken }: { provider: 'google' | 'facebook'; accessToken: string }) {
      try {
        const data = await api<{ session: Session; user: User }>('/api/auth/social', {
          method: 'POST',
          body: JSON.stringify({ provider, accessToken }),
        });
        localStorage.setItem(TOKEN_KEY, data.session.access_token);
        emitAuth('SIGNED_IN', data.session);
        return { data, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : 'Social login failed' } };
      }
    },
    async signOut() {
      localStorage.removeItem(TOKEN_KEY);
      emitAuth('SIGNED_OUT', null);
      return { error: null };
    },
    async getSession() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return { data: { session: null }, error: null };
      try {
        const data = await api<{ session: Session }>('/api/auth/session');
        return { data: { session: data.session }, error: null };
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        return { data: { session: null }, error: null };
      }
    },
    async getUser() {
      const sessionResponse = await this.getSession();
      return { data: { user: sessionResponse.data.session?.user ?? null }, error: null };
    },
    async updateUser(updates: { email?: string; password?: string }) {
      try {
        const data = await api<{ session: Session; user: User }>('/api/auth/user', {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        if (data.session?.access_token) localStorage.setItem(TOKEN_KEY, data.session.access_token);
        emitAuth('USER_UPDATED', data.session);
        return { data, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : 'Update failed' } };
      }
    },
    onAuthStateChange(callback: AuthListener) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => { listeners.delete(callback); } } } };
    },
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File, _options?: unknown) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('bucket', bucket);
            formData.append('path', path);
            const res = await fetch(`${API_BASE_URL}/api/uploads`, { method: 'POST', headers: authHeaders(), body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            return { data: { path: data.path }, error: null };
          } catch (error) {
            return { data: null, error: { message: error instanceof Error ? error.message : 'Upload failed' } };
          }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `${API_BASE_URL}/uploads/${path}` } };
        },
      };
    },
  },
  channel(_name?: string) {
    const channel = { on: (_event: string, _filter: unknown, _callback: unknown) => channel, subscribe: () => channel };
    return channel;
  },
  removeChannel(_channel?: unknown) {},
};

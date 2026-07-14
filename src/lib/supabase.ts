const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('admin_token') || '';
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    return {
      data: null,
      error: {
        message: payload?.message || payload?.error || `Request failed with status ${response.status}`,
      },
    };
  }

  return { data: payload, error: null };
}

type OrderOptions = { ascending?: boolean };

type QueryState = {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  payload?: unknown;
  orderColumn?: string;
  ascending?: boolean;
  single?: boolean;
  eqColumn?: string;
  eqValue?: string;
};

class QueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private state: QueryState;

  constructor(table: string) {
    this.state = { table, action: 'select' };
  }

  select(_columns = '*') {
    this.state.action = 'select';
    return this;
  }

  insert(payload: unknown) {
    this.state.action = 'insert';
    this.state.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.state.action = 'update';
    this.state.payload = payload;
    return this;
  }

  delete() {
    this.state.action = 'delete';
    return this;
  }

  eq(column: string, value: string) {
    this.state.eqColumn = column;
    this.state.eqValue = value;
    return this;
  }

  order(column: string, options: OrderOptions = {}) {
    this.state.orderColumn = column;
    this.state.ascending = options.ascending !== false;
    return this;
  }

  single() {
    this.state.single = true;
    return this;
  }

  async execute() {
    const { table, action, payload, orderColumn, ascending, single, eqColumn, eqValue } = this.state;

    if (action === 'select') {
      const params = new URLSearchParams();
      if (orderColumn) params.set('order', `${orderColumn}:${ascending ? 'asc' : 'desc'}`);
      if (single) params.set('single', 'true');
      const qs = params.toString() ? `?${params.toString()}` : '';
      return apiFetch(`/${table}${qs}`);
    }

    if (action === 'insert') {
      return apiFetch(`/${table}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (action === 'update') {
      if (!eqValue || eqColumn !== 'id') {
        return { data: null, error: { message: 'MongoDB API updates require eq("id", value).' } };
      }
      return apiFetch(`/${table}/${eqValue}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    }

    if (action === 'delete') {
      if (!eqValue || eqColumn !== 'id') {
        return { data: null, error: { message: 'MongoDB API deletes require eq("id", value).' } };
      }
      return apiFetch(`/${table}/${eqValue}`, {
        method: 'DELETE',
      });
    }

    return { data: null, error: { message: 'Unsupported query action.' } };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  auth: {
    async signInWithPassword(credentials: { email: string; password: string }) {
      const result = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      if (result.data?.token) {
        localStorage.setItem('admin_token', result.data.token);
        localStorage.setItem('admin_user', JSON.stringify(result.data.user));
      }

      return result;
    },
    async getSession() {
      const token = getToken();
      if (!token) return { data: { session: null }, error: null };

      const result = await apiFetch('/auth/me');
      if (result.error) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        return { data: { session: null }, error: result.error };
      }

      return { data: { session: { access_token: token, user: result.data.user } }, error: null };
    },
    async getUser() {
      const result = await apiFetch('/auth/me');
      if (result.error) return { data: { user: null }, error: result.error };
      return { data: { user: result.data.user }, error: null };
    },
    async signOut() {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      return { error: null };
    },
  },
};

export async function uploadFile(file: File, folder: string): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const result = await apiFetch('/upload', {
    method: 'POST',
    body: formData,
  });

  if (result.error) {
    console.error('Upload error:', result.error);
    return null;
  }

  return result.data?.url || null;
}

export async function deleteFile(url: string): Promise<boolean> {
  const result = await apiFetch('/upload', {
    method: 'DELETE',
    body: JSON.stringify({ url }),
  });

  return !result.error;
}

export type AboutInfo = {
  id: string;
  name: string;
  title: string;
  bio: string;
  tagline: string;
  years_experience: number;
  projects_completed: number;
  resume_url: string;
  profile_image_url: string;
  logo_url: string;
  hero_background_url: string;
  hero_status_text: string;
  hero_cta_primary_text: string;
  hero_cta_secondary_text: string;
  hero_greeting: string;
  created_at: string;
  updated_at: string;
};

export type Skill = {
  id: string;
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'mobile';
  level: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  detailed_description: string;
  tech: string[];
  image_url: string;
  gallery_urls: string[];
  live_url: string;
  github_url: string;
  github_url_public: boolean;
  category: 'fullstack' | 'frontend' | 'backend' | 'mobile';
  display_order: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

export type Experience = {
  id: string;
  title: string;
  company: string;
  period: string;
  description: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type Education = {
  id: string;
  degree: string;
  institution: string;
  period: string;
  location: string;
  result: string;
  description: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type ContactInfo = {
  id: string;
  email: string;
  phone: string;
  location: string;
  github_url: string;
  linkedin_url: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  name: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type ProjectComment = {
  id: string;
  project_id: string;
  project_title: string;
  name: string;
  email: string;
  comment: string;
  is_approved: boolean;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
};

export type Certificate = {
  id: string;
  title: string;
  issuer: string;
  issue_date: string;
  credential_id: string;
  credential_url: string;
  image_url: string;
  description: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};


export type HeroMedia = {
  id: string;
  title: string;
  media_url: string;
  media_type: 'image' | 'video';
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type DeliveryBasePoint = {
  id: string;
  name: string;
  address: string;
  plus_code: string;
  latitude: number;
  longitude: number;
  contact_person: string;
  phone: string;
  notes: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};


export interface User {
  id: number;
  username: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  uploadKey: string | null;
  csrfToken: string | null;
}

export interface ThemeContextType {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
}

export interface ViewsData {
  date: string;
  views: number;
}

export interface DiskUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface CountryViews {
  country: string;
  code: string;
  views: number;
  percentage: number;
}

export interface ImageView {
  id: number;
  image_id: number;
  ip: string;
  country: string;
  country_name: string;
  country_code: string;
  user_agent: string;
  viewed_at: string;
  
  imageId?: number;
  userAgent?: string;
  viewedAt?: string;
}

export interface Visitor {
  id: number;
  ip: string;
  country: string;
  countryCode: string;
  browser: string;
  os: string;
  timestamp: string;
}

export interface Image {
  id: number;
  uuid: string;
  filename: string;
  extension: string;
  size: number;
  uploadedAt: string;
  isPrivate: boolean;
  privateKey?: string;
  views: number;
  url: string;
  full_link?: string;
  is_private?: boolean;
  private_key?: string;
}

export interface UploadResponse {
  uuid: string;
  filename: string;
  extension: string;
  size: number;
  isPrivate: boolean;
  privateKey?: string;
  url: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  username: string;
}

export interface ErrorResponse {
  error: string;
}

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: {
    value: number;
    isPositive: boolean;
  };
  helperText?: string;
}

export interface RecentView {
  id: number;
  imageId: number;
  imageUuid: string;
  ip: string;
  country: string;
  country_name: string;
  country_code: string;
  countryCode?: string;
  userAgent: string;
  viewedAt: string;
}

export interface RecentViewsResponse {
  views: RecentView[];
}

export interface PaginatedResponse<T> {
  images: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface DashboardStats {
  total_images: number;
  private_images: number;
  total_views: number;
}

export interface Config {
  enable_ip_tracking: boolean;
  max_file_size: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  username: string;
  csrf_token: string;
}

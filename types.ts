
import type { FC, SVGProps } from 'react';

export interface Product {
  id: string; // Will be UUID from database
  name: string;
  retailPrice: number; // Renamed from price
  salonPrice: number;
  exchangeRate: number;
  description: string;
  imageUrl?: string;
  created_at?: string; 
}

export interface OrderItem {
  id?: string; // Will be UUID from database, optional for new items
  order_id?: string; // Foreign key
  productId: string; // Can be a generic ID or UUID if product is in DB
  productName: string;
  quantity: number;
  price: number; // Price per unit at the time of order
  created_at?: string;
}

export interface Customer {
  id: string; // Will be UUID from database
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  joinDate: string; // Consider making this a date type if DB supports it easily
  instagramHandle?: string;
  viberNumber?: string;
  created_at?: string;
  // future: avatarUrl?: string;
}

export interface Order {
  id: string; // Will be UUID from database
  customerId: string; // Link to Customer (UUID)
  customerName: string; // Denormalized for display convenience
  date: string; // ISO string format for date
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  totalAmount: number;
  items: OrderItem[];
  discount?: number;
  created_at?: string;
}

export interface NavItem {
  name: string;
  path: string;
  icon: FC<SVGProps<SVGSVGElement>>;
}

export interface DashboardStat {
  title: string;
  value: string;
  icon: FC<SVGProps<SVGSVGElement>>;
  color: string;
  percentageChange?: string;
  isPositive?: boolean;
  isLoading?: boolean; // Added isLoading property
}

export interface AuthenticatedUser {
  email: string;
  name?: string;
  picture?: string;
  role?: 'admin' | 'manager'; // Added role
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  dateAdded: string; // This will be derived from created_at from the database
  notes?: string;
}

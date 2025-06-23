
import type { FC, SVGProps } from 'react';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  // stock: number; // Removed stock
  description: string;
  imageUrl?: string;
}

export interface OrderItem {
  productId: string; // Can be a generic ID if product not in system
  productName: string;
  quantity: number;
  price: number; // Price per unit at the time of order
}

export interface Customer {
  id: string;
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
  joinDate: string;
  // future: avatarUrl?: string;
}

export interface Order {
  id: string;
  customerId: string; // Link to Customer
  customerName: string; // Denormalized for display convenience
  date: string; // ISO string format for date
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  totalAmount: number;
  items: OrderItem[];
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
}

// AuthenticatedUser interface removed
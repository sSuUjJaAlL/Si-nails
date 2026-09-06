export type Role = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type PaymentType = 'CASH' | 'ONLINE';
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  visits?: number;
  totalSpent?: number;
  lastVisit?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Service {
  id: string;
  name: string;
  defaultPrice: number;
  active: boolean;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  amount: number;
  paymentType: PaymentType;
  status: AppointmentStatus;
  client: { id: string; name: string; phone?: string | null };
  service: { id: string; name: string; defaultPrice?: number };
  createdBy?: { id: string; name: string };
  employee?: { id: string; name: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentRow {
  id: string;
  date: string;
  time: string;
  amount: number;
  paymentType: PaymentType;
  clientName: string;
  serviceType: string;
  employeeId: string;
  employeeName: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface BusinessReport {
  range: { from: string; to: string; period: string };
  summary: {
    totalRevenue: number;
    totalClients: number;
    totalServices: number;
    cashRevenue: number;
    onlineRevenue: number;
    totalAppointments: number;
  };
  chart: { date: string; revenue: number; cash: number; online: number }[];
  servicePerformance: { name: string; bookings: number; revenue: number }[];
  generatedAt: string;
}

/** @deprecated Prefer BusinessReport for admin reports */
export interface ReportSummary {
  today: {
    appointments: number;
    revenue: number;
    cashRevenue: number;
    onlineRevenue: number;
  };
  week: { totalRevenue: number; cashRevenue: number; onlineRevenue: number; appointments: number };
  month: { totalRevenue: number; cashRevenue: number; onlineRevenue: number; appointments: number };
  allTime: {
    totalRevenue: number;
    cashRevenue: number;
    onlineRevenue: number;
    appointments: number;
    clients: number;
  };
  range: {
    from: string;
    to: string;
    totalRevenue: number;
    cashRevenue: number;
    onlineRevenue: number;
    appointments: number;
  };
  todayAppointments: Appointment[];
  recentAppointments: Appointment[];
  popularServices?: Array<{ serviceId: string; name: string; count: number; revenue: number }>;
  recentClients?: Array<{ id: string; name: string; phone: string | null; createdAt: string }>;
  employeeActivity?: Array<{
    userId: string;
    name: string;
    role: Role;
    appointments: number;
    revenue: number;
  }>;
  chart: { date: string; revenue: number; cash: number; online: number }[];
}

export interface UserDashboardData {
  todayAppointments: Appointment[];
  todayCount: number;
  todayServices: number;
  personalTodayCount: number;
  personalTodayRevenue: number;
}

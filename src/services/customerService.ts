import { db } from './storage/db';
import { Customer, CustomerPointHistory, Order } from '@/types';

export const customerService = {
  /**
   * Retrieves all customers from storage
   */
  getCustomers: (searchQuery?: string): Customer[] => {
    const customers = db.getSnapshot().customers || [];
    if (!searchQuery || !searchQuery.trim()) {
      return customers;
    }
    const q = searchQuery.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.customerId.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  },

  /**
   * Get single customer by ID
   */
  getCustomerById: (id: string): Customer | undefined => {
    const customers = db.getSnapshot().customers || [];
    return customers.find((c) => c.id === id || c.customerId === id);
  },

  /**
   * Get single customer by Phone Number
   */
  getCustomerByPhone: (phone: string): Customer | undefined => {
    const cleanPhone = phone.replace(/\s+/g, '');
    const customers = db.getSnapshot().customers || [];
    return customers.find(
      (c) => c.phone.replace(/\s+/g, '') === cleanPhone || c.phone.includes(phone)
    );
  },

  /**
   * Create or update a customer record
   */
  saveCustomer: (customerData: Partial<Customer> & { name: string; phone: string }): Customer => {
    const customers = db.getSnapshot().customers || [];
    const now = new Date().toISOString();

    if (customerData.id) {
      // Update existing
      let updated: Customer | null = null;
      db.update('customers', (prev) =>
        (prev || []).map((c) => {
          if (c.id === customerData.id) {
            updated = {
              ...c,
              ...customerData,
              phone: customerData.phone.trim(),
            };
            return updated;
          }
          return c;
        })
      );
      if (updated) return updated;
    }

    // Create new
    const nextNum = customers.length + 1001;
    const newCustomer: Customer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      customerId: `CUST-${nextNum}`,
      name: customerData.name.trim(),
      phone: customerData.phone.trim(),
      email: customerData.email?.trim() || '',
      address: customerData.address?.trim() || '',
      birthday: customerData.birthday || '',
      tier: customerData.tier || 'BRONZE',
      points: customerData.points ?? 25, // default signup bonus
      totalSpentCents: customerData.totalSpentCents || 0,
      totalOrders: customerData.totalOrders || 0,
      lastVisit: now,
      createdAt: now,
      notes: customerData.notes || '',
      pointHistory: [
        {
          id: `pt_${Date.now()}`,
          customerId: `CUST-${nextNum}`,
          type: 'SIGNUP_BONUS',
          points: customerData.points ?? 25,
          balanceAfter: customerData.points ?? 25,
          note: 'Welcome signup reward points',
          createdAt: now,
        },
      ],
    };

    db.update('customers', (prev) => [newCustomer, ...(prev || [])]);
    return newCustomer;
  },

  /**
   * Award points to customer
   */
  addPoints: (
    customerId: string,
    points: number,
    note: string,
    orderId?: string,
    orderNumber?: string
  ): Customer | undefined => {
    let updatedCustomer: Customer | undefined;

    db.update('customers', (prev) =>
      (prev || []).map((c) => {
        if (c.id === customerId || c.customerId === customerId) {
          const newBalance = c.points + points;
          const historyEntry: CustomerPointHistory = {
            id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            customerId: c.id,
            type: 'EARNED',
            points,
            balanceAfter: newBalance,
            orderId,
            orderNumber,
            note,
            createdAt: new Date().toISOString(),
          };

          updatedCustomer = {
            ...c,
            points: newBalance,
            pointHistory: [historyEntry, ...(c.pointHistory || [])],
          };
          return updatedCustomer;
        }
        return c;
      })
    );

    return updatedCustomer;
  },

  /**
   * Redeem points from customer
   */
  redeemPoints: (
    customerId: string,
    points: number,
    note: string,
    orderId?: string,
    orderNumber?: string
  ): Customer | undefined => {
    let updatedCustomer: Customer | undefined;

    db.update('customers', (prev) =>
      (prev || []).map((c) => {
        if (c.id === customerId || c.customerId === customerId) {
          const newBalance = Math.max(0, c.points - points);
          const historyEntry: CustomerPointHistory = {
            id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            customerId: c.id,
            type: 'REDEEMED',
            points: -points,
            balanceAfter: newBalance,
            orderId,
            orderNumber,
            note,
            createdAt: new Date().toISOString(),
          };

          updatedCustomer = {
            ...c,
            points: newBalance,
            pointHistory: [historyEntry, ...(c.pointHistory || [])],
          };
          return updatedCustomer;
        }
        return c;
      })
    );

    return updatedCustomer;
  },

  /**
   * Get orders for a customer
   */
  getCustomerOrders: (customer: Customer): Order[] => {
    const orders = db.getSnapshot().orders || [];
    const cleanPhone = customer.phone.replace(/\s+/g, '');
    const cleanName = customer.name.toLowerCase().trim();

    return orders.filter((o) => {
      if (o.customerPhone && o.customerPhone.replace(/\s+/g, '') === cleanPhone) {
        return true;
      }
      if (o.customerName && o.customerName.toLowerCase().trim() === cleanName) {
        return true;
      }
      return false;
    });
  },
};

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

// Layouts
import { AdminLayout } from '@/features/admin/layouts/AdminLayout';

// POS Pages
import { PosLoginPage } from '@/features/pos/pages/PosLoginPage';
import { PosMainPage } from '@/features/pos/pages/PosMainPage';
import { CloseShiftPage } from '@/features/pos/pages/CloseShiftPage';

// Admin Pages
import { AdminLoginPage } from '@/features/admin/pages/AdminLoginPage';
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage';
import { AdminOrdersPage } from '@/features/admin/pages/AdminOrdersPage';
import { AdminProductsPage } from '@/features/admin/pages/AdminProductsPage';
import { AdminCategoriesPage } from '@/features/admin/pages/AdminCategoriesPage';
import { AdminModifiersPage } from '@/features/admin/pages/AdminModifiersPage';
import { AdminIngredientsPage } from '@/features/admin/pages/AdminIngredientsPage';
import { AdminRecipesPage } from '@/features/admin/pages/AdminRecipesPage';
import { AdminInventoryPage } from '@/features/admin/pages/AdminInventoryPage';
import { AdminPurchasesPage } from '@/features/admin/pages/AdminPurchasesPage';
import { AdminSuppliersPage } from '@/features/admin/pages/AdminSuppliersPage';
import { AdminExpensesPage } from '@/features/admin/pages/AdminExpensesPage';
import { AdminCashDrawerPage } from '@/features/admin/pages/AdminCashDrawerPage';
import { AdminShiftsPage } from '@/features/admin/pages/AdminShiftsPage';
import { AdminReportsPage } from '@/features/admin/pages/AdminReportsPage';
import { AdminUsersPage } from '@/features/admin/pages/AdminUsersPage';
import { AdminAccountingPage } from '@/features/admin/pages/AdminAccountingPage';
import { AdminSettingsPage } from '@/features/admin/pages/AdminSettingsPage';
import { AdminReceiptDesignerPage } from '@/features/admin/pages/AdminReceiptDesignerPage';

export const router = createBrowserRouter([
  // Root Redirect
  {
    path: '/',
    element: <Navigate to="/pos" replace />,
  },

  // Cashier POS Routes
  {
    path: '/pos/login',
    element: <PosLoginPage />,
  },
  {
    path: '/pos',
    element: <PosMainPage />,
  },
  {
    path: '/pos/close-shift',
    element: <CloseShiftPage />,
  },

  // Admin Authentication
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
  },

  // Admin Management Area (Protected by Layout)
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <AdminDashboardPage />,
      },
      {
        path: 'orders',
        element: <AdminOrdersPage />,
      },
      {
        path: 'products',
        element: <AdminProductsPage />,
      },
      {
        path: 'categories',
        element: <Navigate to="/admin/products?tab=categories" replace />,
      },
      {
        path: 'modifiers',
        element: <Navigate to="/admin/products?tab=modifiers" replace />,
      },
      {
        path: 'ingredients',
        element: <Navigate to="/admin/inventory?tab=stock" replace />,
      },
      {
        path: 'recipes',
        element: <Navigate to="/admin/products" replace />,
      },
      {
        path: 'inventory',
        element: <AdminInventoryPage />,
      },
      {
        path: 'purchases',
        element: <Navigate to="/admin/inventory?tab=purchases" replace />,
      },
      {
        path: 'suppliers',
        element: <Navigate to="/admin/inventory?tab=purchases" replace />,
      },
      {
        path: 'expenses',
        element: <Navigate to="/admin/accounting?tab=expenses" replace />,
      },
      {
        path: 'cash-drawers',
        element: <AdminCashDrawerPage />,
      },
      {
        path: 'shifts',
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        path: 'reports',
        element: <AdminReportsPage />,
      },
      {
        path: 'users',
        element: <AdminUsersPage />,
      },
      {
        path: 'accounting',
        element: <AdminAccountingPage />,
      },
      {
        path: 'audit',
        element: <Navigate to="/admin/accounting" replace />,
      },
      {
        path: 'settings',
        element: <AdminSettingsPage />,
      },
      {
        path: 'receipt-customizer',
        element: <AdminReceiptDesignerPage />,
      },
      {
        path: 'receipt-designer',
        element: <AdminReceiptDesignerPage />,
      },
    ],
  },

  // Catch-all
  {
    path: '*',
    element: <Navigate to="/pos" replace />,
  },
]);

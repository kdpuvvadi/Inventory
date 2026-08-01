import { createBrowserRouter } from 'react-router'

import AppLayout from '@/layouts/app-layout'
import AuthLayout from '@/layouts/auth-layout'
import CategoriesPage from '@/pages/categories'
import CategoryDetailPage from '@/pages/category-detail'
import CustomerDetailPage from '@/pages/customer-detail'
import CustomersPage from '@/pages/customers'
import DashboardPage from '@/pages/dashboard'
import DocumentDetailPage from '@/pages/document-detail'
import DocumentFormPage from '@/pages/document-form'
import DocumentsPage from '@/pages/documents'
import InventoryPage from '@/pages/inventory'
import LoginPage from '@/pages/login'
import ManufacturerDetailPage from '@/pages/manufacturer-detail'
import ManufacturersPage from '@/pages/manufacturers'
import ManufacturingPage from '@/pages/manufacturing'
import ProductDetailPage from '@/pages/product-detail'
import ProductFormPage from '@/pages/product-form'
import ProductsPage from '@/pages/products'
import ProfilePage from '@/pages/profile'
import ProjectDetailPage from '@/pages/project-detail'
import ProjectsPage from '@/pages/projects'
import PurchaseOrderDetailPage from '@/pages/purchase-order-detail'
import PurchaseOrderFormPage from '@/pages/purchase-order-form'
import PurchaseOrdersPage from '@/pages/purchase-orders'
import ReportsPage from '@/pages/reports'
import SettingsPage from '@/pages/settings'
import StockIntakePage from '@/pages/stock-intake'
import SupplierDetailPage from '@/pages/supplier-detail'
import SuppliersPage from '@/pages/suppliers'
import TransactionsPage from '@/pages/transactions'
import UsersPage from '@/pages/users'
import WarehousesPage from '@/pages/warehouses'
import ProtectedRoute from '@/routes/protected-route'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/new', element: <ProductFormPage /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'categories/:id', element: <CategoryDetailPage /> },
      { path: 'manufacturers', element: <ManufacturersPage /> },
      { path: 'manufacturers/:id', element: <ManufacturerDetailPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'suppliers/:id', element: <SupplierDetailPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },
      { path: 'inventory/intake', element: <StockIntakePage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'warehouses', element: <WarehousesPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'purchase-orders', element: <PurchaseOrdersPage /> },
      { path: 'purchase-orders/new', element: <PurchaseOrderFormPage /> },
      {
        path: 'purchase-orders/:id',
        element: <PurchaseOrderDetailPage />,
      },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'documents/new', element: <DocumentFormPage /> },
      { path: 'documents/:id/edit', element: <DocumentFormPage /> },
      { path: 'documents/:id', element: <DocumentDetailPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'manufacturing', element: <ManufacturingPage /> },
      {
        path: 'users',
        element: (
          <ProtectedRoute roles={['administrator']}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

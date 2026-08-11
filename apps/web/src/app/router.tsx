import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TenantLayout } from "@/components/layout/tenant-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import {
  ForgotPasswordPage,
  LoginPage,
  OnboardingPage,
  PinLoginPage,
  ResetPasswordPage,
} from "@/features/auth/pages";
import { DashboardPage } from "@/features/dashboard/page";
import { PosPage } from "@/features/pos/page";
import {
  AlertsPage,
  BrandsPage,
  CategoriesPage,
  CountsPage,
  CustomerDetailPage,
  CustomersPage,
  ExpensesPage,
  InventoryPage,
  LabelsPage,
  MovementsPage,
  OfflineQueuePage,
  ProductFormPage,
  ProductImportPage,
  ProductsPage,
  PurchaseOrdersPage,
  PurchasesPage,
  RegisterPage,
  ReturnWizardPage,
  ReturnsPage,
  SaleDetailPage,
  SalesPage,
  SupplierPaymentsPage,
  SuppliersPage,
  TransfersPage,
} from "@/features/modules/pages";
import {
  InventoryReportPage,
  PayablesReportPage,
  ProfitReportPage,
  ReceivablesReportPage,
  ReportsHubPage,
  SalesReportPage,
  SettingsPage,
  SettingsSectionPage,
} from "@/features/reports/pages";
import {
  AdminAuditPage,
  AdminDashboardPage,
  AdminHealthPage,
  AdminPlansPage,
  AdminSubscriptionsPage,
  AdminTenantDetailPage,
  AdminTenantsPage,
} from "@/features/admin/pages";
import { PrintersSettingsPage } from "@/features/settings/printers-page";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/pin" element={<PinLoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route element={<TenantLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/pos/offline-queue" element={<OfflineQueuePage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/sales/:id" element={<SaleDetailPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/returns/new" element={<ReturnWizardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/import" element={<ProductImportPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/labels" element={<LabelsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inventory/movements" element={<MovementsPage />} />
          <Route path="/inventory/counts" element={<CountsPage />} />
          <Route path="/inventory/transfers" element={<TransfersPage />} />
          <Route path="/inventory/alerts" element={<AlertsPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />
          <Route path="/supplier-payments" element={<SupplierPaymentsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/reports" element={<ReportsHubPage />} />
          <Route path="/reports/sales" element={<SalesReportPage />} />
          <Route path="/reports/profit" element={<ProfitReportPage />} />
          <Route path="/reports/inventory" element={<InventoryReportPage />} />
          <Route path="/reports/payables" element={<PayablesReportPage />} />
          <Route path="/reports/receivables" element={<ReceivablesReportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/business" element={<SettingsSectionPage title="Business profile" />} />
          <Route path="/settings/branches" element={<SettingsSectionPage title="Branches" />} />
          <Route path="/settings/registers" element={<SettingsSectionPage title="Registers" />} />
          <Route path="/settings/users" element={<SettingsSectionPage title="Users & roles" />} />
          <Route path="/settings/taxes" element={<SettingsSectionPage title="Taxes" />} />
          <Route path="/settings/receipts" element={<SettingsSectionPage title="Receipts" />} />
          <Route path="/settings/printers" element={<PrintersSettingsPage />} />
          <Route path="/settings/sales-rules" element={<SettingsSectionPage title="Sales & stock rules" />} />
          <Route path="/settings/credit-loyalty" element={<SettingsSectionPage title="Credit & loyalty" />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="tenants" element={<AdminTenantsPage />} />
          <Route path="tenants/:id" element={<AdminTenantDetailPage />} />
          <Route path="plans" element={<AdminPlansPage />} />
          <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
          <Route path="audit-logs" element={<AdminAuditPage />} />
          <Route path="health" element={<AdminHealthPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

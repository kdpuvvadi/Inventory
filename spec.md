# Inventory Management System Specification

## Overview

Build a modern, scalable, and responsive Inventory Management System for managing inventory, procurement, projects, manufacturing, and traceability. The system should be suitable for engineering, automation, and manufacturing environments where every physical item can be tracked throughout its lifecycle.

The application should be built using **PocketBase** as the backend and **React** as the frontend.

---

# Technology Stack

## Backend

- PocketBase
- SQLite (managed by PocketBase)
- Built-in Authentication
- Role-based access using API Rules
- REST API
- Realtime subscriptions
- File storage for images and documents
- PocketBase JavaScript SDK

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- TanStack Table
- React Hook Form
- Zod
- PocketBase JavaScript SDK
- Recharts

---

# Design Goals

- Modern responsive UI
- Desktop-first with mobile support
- Fast and lightweight
- Modular architecture
- Fully type-safe
- Easy to extend
- Complete inventory traceability
- Audit-friendly
- Manufacturing ready

---

# Core Modules

- Dashboard
- Products
- Inventory
- Projects
- Manufacturers
- Suppliers / Dealers / Distributors
- Customers
- Categories
- Purchase Orders
- Stock Transactions
- Reports
- Manufacturing (BOM)
- User Management
- Settings

---

# Authentication

Use PocketBase authentication.

Roles:

- Administrator
- Inventory Manager
- Purchase
- Sales
- Store Keeper
- Read Only

Protect all authenticated routes.

---

# Dashboard

Display:

- Total Products
- Current Inventory Value
- Available Stock
- Reserved Stock
- Damaged Stock
- Low Stock Items
- Out of Stock Items
- Recent Transactions
- Active Projects
- Purchase Orders Awaiting Receipt

Charts:

- Stock Movement
- Inventory by Category
- Inventory by Manufacturer
- Inventory by Project
- Monthly Purchases

---

# Product Management

Every physical item should be uniquely identifiable.

## Product Fields

- Asset Tag (unique)
- Product Name
- Product Description
- Model
- Manufacturer
- Supplier / Dealer / Distributor
- Manufacturer Product Code
- Internal SKU
- Serial Number
- Lot Number
- Purchase Date
- Received Date
- Unit of Measure
- Barcode
- QR Code
- Category
- Sub Category
- Tags
- Status
- Product Image
- Manuals
- Certificates

Status examples:

- In Stock
- Reserved
- Assigned
- Installed
- Damaged
- Scrap
- Sold
- Returned

---

# Manufacturers

Store:

- Company Name
- Website
- Address
- Contact Person
- Phone
- Email
- Notes

---

# Suppliers / Dealers / Distributors

Store:

- Company Name
- Contact Person
- Phone
- Email
- Address
- GST/VAT Number
- Website
- Notes

---

# Categories

Support:

- Categories
- Sub Categories

Unlimited nesting is optional.

---

# Inventory

Track current inventory.

Fields:

- Product
- Warehouse
- Location
- Quantity
- Available
- Reserved
- Damaged
- Minimum Stock
- Maximum Stock
- Reorder Level

Inventory quantities should never be edited directly.

All changes must occur through stock transactions.

---

# Asset Tracking

Every inventory item must have a complete lifecycle.

Track:

- Purchase
- Goods Receipt
- Inspection
- Storage
- Reservation
- Project Assignment
- Installation
- Removal
- Repair
- Scrap
- Disposal

Provide complete history for every Asset Tag.

---

# Projects

Projects represent customer jobs or internal manufacturing projects.

Fields:

- Project Name
- Customer
- Description
- Start Date
- End Date
- Status

Features:

- Assign products
- Remove products
- View assigned inventory
- View project history

Business Rules:

- Assigning a product to a project removes it from available inventory.
- Removing a product from a project returns it to inventory.
- Every assignment creates a stock transaction.

---

# Customers

Store:

- Company Name
- Contact Person
- Phone
- Email
- Address
- Notes

---

# Purchase Orders

Features:

- Create
- Edit
- Receive
- Cancel
- Close

Status:

- Draft
- Ordered
- Partially Received
- Received
- Cancelled

Fields:

- PO Number
- Supplier
- Purchase Date
- Expected Date
- Status
- Notes

Each Purchase Order contains multiple items.

---

# Stock Transactions

Every inventory movement must create a transaction.

Transaction Types:

- Purchase
- Sale
- Production
- Consumption
- Return
- Adjustment
- Scrap
- Transfer
- Project Assignment
- Project Return

Store:

- Product
- Quantity
- Before Quantity
- After Quantity
- Warehouse
- Location
- Date
- User
- Reason
- Reference Document
- Remarks

Transactions are immutable.

---

# Barcode & QR Support

Support:

- Barcode generation
- QR code generation
- Barcode scanning
- QR scanning
- Mobile camera scanning
- Printable labels

---

# Search

Global search should support:

- Asset Tag
- SKU
- Product Name
- Manufacturer
- Supplier
- Barcode
- QR Code
- Serial Number
- Lot Number
- Category
- Project

---

# Filters

Products:

- Category
- Sub Category
- Manufacturer
- Supplier
- Status
- Tags

Inventory:

- Warehouse
- Location
- Low Stock
- Out of Stock
- Damaged

Transactions:

- Product
- User
- Date Range
- Transaction Type

Projects:

- Status
- Customer

---

# Reports

## Inventory Reports

- Current Inventory
- Inventory Valuation
- Stock Movement
- Low Stock
- Dead Stock
- Fast Moving
- Slow Moving
- Damaged Inventory

## Purchase Reports

- Purchases by Supplier
- Purchase History
- Outstanding Purchase Orders

## Project Reports

- Inventory by Project
- Project Material Usage
- Returned Materials

---

# Audit Trail

Every change must be logged.

Record:

- User
- Timestamp
- Previous Value
- New Value
- Action
- Collection
- Record ID

Audit logs should never be deleted.

---

# Manufacturing

Support:

- Bill of Materials (BOM)
- Raw Materials
- Finished Goods
- Work in Progress (WIP)
- Material Consumption
- Production Transactions

Future expansion should support automatic inventory consumption from BOMs.

---

# File Management

Use PocketBase file storage.

Support:

- Product Images
- Manuals
- Datasheets
- Certificates
- Inspection Reports
- Purchase Documents

---

# Realtime

Use PocketBase realtime subscriptions.

Automatically update:

- Dashboard
- Inventory
- Products
- Projects
- Transactions
- Purchase Orders

No manual refresh should be required.

---

# Tables

Use TanStack Table.

Support:

- Sorting
- Pagination
- Search
- Column Filters
- Column Visibility
- Sticky Headers
- CSV Export

---

# Forms

Use:

- React Hook Form
- Zod

Provide inline validation and user-friendly error messages.

---

# Routing

Pages:

- Login
- Dashboard
- Products
- Categories
- Manufacturers
- Suppliers
- Customers
- Inventory
- Projects
- Purchase Orders
- Transactions
- Reports
- Manufacturing
- Users
- Profile
- Settings

---

# UI

Use shadcn/ui.

Layout:

- Sidebar Navigation
- Top Navigation
- Breadcrumbs
- Responsive Drawer
- Toast Notifications
- Command Palette (optional)

Support:

- Light Theme
- Dark Theme
- System Theme

---

# PocketBase Integration

Use the PocketBase JavaScript SDK exclusively.

Implement:

- Authentication
- CRUD Operations
- Relation Expansion
- File Uploads
- Realtime Subscriptions
- Filtering
- Pagination

Use collection relations instead of duplicating data.

---

# Architecture

```
src/
├── components/
├── pages/
├── layouts/
├── routes/
├── hooks/
├── contexts/
├── services/
├── lib/
├── schemas/
├── types/
├── utils/
├── assets/
└── styles/
```

---

# Coding Standards

- Strict TypeScript
- Functional React components
- React Hooks only
- Reusable components
- Clean architecture
- ESLint
- Prettier
- Feature-based organization
- Avoid duplicated business logic

---

# Future Enhancements

The architecture should be designed to support future modules without major refactoring:

- Multi-company support
- Multiple warehouses
- Warehouse bin management
- Serial number tracking
- Lot and batch tracking
- Calibration management
- Equipment maintenance
- Vendor portal
- Customer portal
- Sales Orders
- Goods Receipt Notes (GRN)
- Goods Issue Notes (GIN)
- Warehouse Transfers
- Approval workflows
- RFID integration
- Mobile application
- Offline synchronization
- API integrations with ERP systems

---

# Deliverables

- Production-ready React application
- PocketBase backend integration
- Responsive and accessible UI
- Complete CRUD functionality
- Realtime inventory synchronization
- Well-structured, maintainable codebase
- Comprehensive README with setup and deployment instructions
- Modular architecture suitable for long-term expansion

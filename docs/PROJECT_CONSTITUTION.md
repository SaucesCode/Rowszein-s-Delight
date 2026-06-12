# PROJECT CONSTITUTION

## Project Name

Rowszein's Delight Management System

---

## Project Purpose

A business management platform for a dessert shop.

The system helps manage:

- Products
- Ingredients
- Recipes
- Sales
- Expenses
- Deliveries
- Profit Analytics

The goal is to help the business track operations, expenses, revenue, and profitability.

---

# Core Development Philosophy

The project must be built incrementally.

Never build multiple major modules simultaneously.

Every module must be completed and tested before moving to the next one.

Priority order:

1. Correct business logic
2. Clean architecture
3. Maintainability
4. Scalability
5. UI polish

Fancy features are never more important than business functionality.

---

# Technology Stack (UPDATED)

## Backend:
- Django
- Django REST Framework
- PostgreSQL
- SimpleJWT
- django-cors-headers
- python-decouple

## Authentication:
- JWT stored in HttpOnly Cookies (NOT localStorage)
- Backend handles authentication state

## Frontend:
- React (Vite)
- TypeScript (recommended)
- React Router DOM
- Axios
- TanStack React Query

## Forms & Validation:
- React Hook Form
- Zod

## UI / Styling:
- Tailwind CSS
- shadcn/ui (recommended)
- lucide-react
- clsx
- tailwind-merge

## Notifications:
- react-hot-toast

## Charts:
- Recharts

## Calendar:
- FullCalendar

## Deployment:
- Backend: Railway / Render
- Frontend: Vercel
- Database: Neon PostgreSQL / Supabase

---

# MVP Scope

Version 1 must only include:

- Authentication
- Ingredients
- Products
- Recipes
- Sales
- Expenses
- Profit Dashboard

DO NOT BUILD:

- Three.js
- Payment Gateways
- SMS Notifications
- Loyalty Systems
- Multi-Branch Support
- Mobile Apps

These belong in future versions.

---

# Modules

## Accounts

Responsibilities:

- Login
- Logout
- JWT Authentication
- User Roles

Roles:

- Admin
- Staff

---

## Ingredients

Store:

- Name
- Quantity
- Unit
- Cost Per Unit
- Supplier

Purpose:

Track inventory costs.

---

## Products

Store:

- Name
- Description
- Price
- Image
- Availability

Purpose:

Represent donut flavors and other desserts.

---

## Recipes

Store ingredient composition for products.

Example:

Chocolate Donut:
- Flour
- Sugar
- Chocolate

Purpose:

Calculate production cost.

---

## Sales

Store:

- Sale
- Sale Items

Purpose:

Track revenue.

---

## Expenses

Store:

- Ingredient Purchases
- Packaging
- Utilities
- Transportation
- Other Expenses

Purpose:

Track business costs.

---

## Dashboard

Display:

- Total Sales
- Total Expenses
- Net Profit
- Best Selling Products

Purpose:

Business analytics.

---

# Required Database Models

User  
Ingredient  
Product  
Recipe  
RecipeIngredient  
Sale  
SaleItem  
Expense  

No additional models should be created without explanation.

---

# Architecture Rules

Every Django app must contain:

- models.py
- serializers.py
- views.py
- urls.py

For complex logic:
- services.py (optional)

Rules:
- Views must be thin
- Business logic must NOT live inside views

---

# Frontend Architecture Rules

## Folder Structure

src/
  components/
  pages/
  services/
  hooks/
  store/
  utils/
  types/
  layouts/

---

## Rules

- API calls ONLY inside services/
- Pages = layout + composition only
- Components = reusable UI only
- No business logic inside UI components

---

# Authentication Rules (CRITICAL)

- JWT stored in HttpOnly cookies
- NEVER use localStorage or sessionStorage
- Frontend checks auth using /auth/me endpoint
- Backend handles authentication entirely

---

# API Architecture Rules

- Use ONE Axios instance
- withCredentials: true must be enabled

## Service Layer Rule:

All API calls must go through services:

services/
  api.ts
  auth.service.ts
  ingredient.service.ts
  sales.service.ts

RULE:
- NO direct API calls inside components

---

# State Management Rules

## 1. Server State (API Data)
Use:
- TanStack React Query (MANDATORY)

## 2. UI State
Use:
- useState (local)
- Zustand (global UI state)

## 3. Auth State
- Managed by backend (HttpOnly cookies)
- Frontend uses /auth/me

---

# UI / UX Rules

- Build functionality first
- Then styling
- Then animations

## Notifications

Use react-hot-toast ONLY

Rules:

- No alert()
- All success actions → toast.success
- All errors → toast.error

---

# Form Rules

Use:

- react-hook-form
- zod validation

No uncontrolled forms for business data.

---

# Feature Completion Definition

A feature is ONLY complete when:

- Backend works
- API tested
- Frontend connected
- Validation added
- Error handling exists
- Toast feedback exists
- Loading states exist

---

# Development Workflow

Follow strictly:

1. Authentication
2. Ingredients
3. Products
4. Recipes
5. Sales
6. Expenses
7. Dashboard

RULE:
- No skipping
- No parallel modules
- No jumping ahead

---

# MVP STRICT RULE

If a feature does NOT directly affect:

- Sales
- Expenses
- Inventory
- Profit

DO NOT BUILD IT.

---

# Backend Structure Rules

Each Django app must include:

- models.py
- serializers.py
- views.py
- urls.py
- services.py (if needed)

Rules:
- Views must be thin
- Business logic goes to services.py
- No heavy logic in serializers

---

# AI Development Rules

- Build ONE module at a time ONLY
- Never generate unrelated features
- Always follow architecture
- Prefer simple solutions over complex ones

## AI Output Format:

Before coding, AI must explain:

1. Why the feature exists
2. Backend structure plan
3. Files to be created/modified
4. Data flow explanation

Then generate code.

---

# Performance Rules

- Use React Query caching
- Use lazy loading for routes
- Avoid unnecessary re-renders
- Optimize only when needed (not prematurely)

---

# Important Rule

The project must always remain understandable by a single developer.

If a solution feels too complex, simplify it.

Business value is more important than technical complexity.
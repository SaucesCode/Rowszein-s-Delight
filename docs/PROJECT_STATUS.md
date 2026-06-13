# PROJECT STATUS

## Project

Rowszein's Delight Management System

## Current Phase

MVP Complete ✅

## Completed

* Authentication (Backend + Frontend)
  - Custom User model (Admin + Staff roles)
  - JWT stored in HttpOnly cookies
  - Login / Logout / Me endpoints
  - Protected routes
  - Login page with validation

* Ingredients (Backend + Frontend)
  - Ingredient model (name, quantity, unit, cost per unit, supplier)
  - Full CRUD endpoints
  - Paginated list
  - Create / Edit form with validation
  - Delete with confirmation
  - Toast notifications

* Products (Backend + Frontend)
  - Product model (name, description, price, image, availability)
  - Full CRUD endpoints
  - Paginated list with image and availability badge
  - Create / Edit form with image upload and preview
  - Delete with confirmation
  - Toast notifications

* Recipes (Backend + Frontend)
  - Recipe model (one-to-one with Product)
  - RecipeIngredient model (ingredient + quantity)
  - Production cost calculated automatically
  - Dynamic ingredient rows in form
  - Full CRUD endpoints
  - Toast notifications

* Expenses (Backend + Frontend)
  - Expense model (category, amount, description, date)
  - Full CRUD endpoints
  - Paginated list with category badges
  - Create / Edit form with date picker
  - Delete with confirmation
  - Toast notifications

* Sales (Backend + Frontend)
  - Sale model with SaleItem (product, quantity, unit price)
  - Total amount auto-calculated from items
  - Unit price auto-filled from product price
  - Live total preview in form
  - Full CRUD endpoints
  - Toast notifications

* Dashboard (Backend + Frontend)
  - All time totals (sales, expenses, net profit)
  - This month breakdown
  - Monthly area chart (sales vs expenses vs profit)
  - Top 5 best selling products
  - No new models — pure aggregation

## In Progress

None

## Not Started

None — MVP complete

## Current Task

None

## Last Decisions

* Django REST Framework
* PostgreSQL
* JWT in HttpOnly Cookies
* React + Vite + TypeScript + TailwindCSS
* Admin and Staff roles only
* CookieJWTAuthentication custom authenticator
* multipart/form-data for image uploads
* useFieldArray for dynamic form rows
* unit_price stored at time of sale
* subtotal_amount stored on SaleItem for aggregation
* Pure aggregation dashboard — no extra models

## Next Task

Version 2 planning (post-MVP)

## Blockers

None

## Notes

Version 1 MVP is complete.

Do NOT build in Version 1:

* Payments
* Loyalty Systems
* SMS Notifications
* Multi-Branch Support
* Mobile Applications
* Three.js Features

Possible Version 2 features:

* Inventory deduction on sale
* Low stock alerts
* Delivery tracking
* User management (admin creates staff accounts)
* Export to PDF / CSV
* Mobile responsive improvements
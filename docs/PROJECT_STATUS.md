# PROJECT STATUS

## Project

Rowszein's Delight Management System

## Current Phase

Dashboard

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

## In Progress

None

## Not Started

* Dashboard

## Current Task

Build Dashboard module — backend first

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

## Next Task

None — MVP complete after Dashboard

## Blockers

None

## Notes

Version 1 focuses only on business operations.

Do not build:

* Payments
* Loyalty Systems
* SMS Notifications
* Multi-Branch Support
* Mobile Applications
* Three.js Features
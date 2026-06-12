# PROJECT STATUS

## Project

Rowszein's Delight Management System

## Current Phase

Recipes

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

## In Progress

None

## Not Started

* Recipes
* Expenses
* Sales
* Dashboard

## Current Task

Build Recipes module — backend first

## Last Decisions

* Django REST Framework
* PostgreSQL
* JWT in HttpOnly Cookies
* React + Vite + TypeScript + TailwindCSS
* Admin and Staff roles only
* CookieJWTAuthentication custom authenticator
* multipart/form-data for image uploads

## Next Task

Build Expenses module

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
# PROJECT STATUS

## Project

Rowszein's Delight Management System

## Current Phase

Products

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

## In Progress

None

## Not Started

* Products
* Recipes
* Expenses
* Sales
* Dashboard

## Current Task

Build Products module — backend first

## Last Decisions

* Django REST Framework
* PostgreSQL
* JWT in HttpOnly Cookies
* React + Vite + TypeScript + TailwindCSS
* Admin and Staff roles only
* CookieJWTAuthentication custom authenticator

## Next Task

Build Recipes module

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
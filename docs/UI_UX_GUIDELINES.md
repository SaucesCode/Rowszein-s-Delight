# UI_UX_GUIDELINES.md

## Purpose

This document defines the user experience, visual design principles, and interface standards for the Rowszein's Delight Management System.

The goal is to create a system that feels:

* Friendly
* Simple
* Modern
* Easy to understand
* Easy to navigate
* Suitable for non-technical users

The system should feel like a donut shop management platform, not corporate accounting software.

---

# Design Philosophy

The application should be approachable for business owners with little to no technical experience.

Prioritize:

1. Clarity
2. Simplicity
3. Readability
4. Consistency
5. Beauty

Avoid:

* Complex interfaces
* Enterprise-style dashboards
* Technical terminology
* Cluttered screens

---

# Target Users

## Owner

The primary user.

Responsibilities:

* Manage products
* Manage ingredients
* Manage recipes
* Record sales
* Record expenses
* Monitor profits

The system should be optimized for a single owner.

---

## Customer

Visitors browsing products on the public website.

Goals:

* View donut flavors
* Browse products easily
* View product images
* Learn about the business
* Contact the shop

---

# Brand Identity

## Personality

The brand should feel:

* Warm
* Sweet
* Friendly
* Playful
* Premium
* Welcoming

---

# Color Palette

## Primary Pink

```css
#FF6FAE
```

Used for:

* Primary buttons
* Links
* Highlights
* Active states

---

## Soft Pink

```css
#FFD6E7
```

Used for:

* Background accents
* Cards
* Sections

---

## Cream

```css
#FFF8F0
```

Used for:

* Main backgrounds

---

## Chocolate Brown

```css
#6B4226
```

Used for:

* Text
* Headings

---

## White

```css
#FFFDFB
```

Used for:

* Cards
* Forms
* Containers

---

# Typography

## Headings

Font:

```text
Poppins
```

---

## Body Text

Font:

```text
Inter
```

---

# Icons

Use:

```text
Lucide React
```

Icons should be used consistently.

Examples:

Dashboard:

```text
LayoutDashboard
```

Ingredients:

```text
Package
```

Products:

```text
Donut (custom icon or dessert icon)
```

Recipes:

```text
BookOpen
```

Sales:

```text
ShoppingCart
```

Expenses:

```text
Receipt
```

Settings:

```text
Settings
```

Logout:

```text
LogOut
```

Do NOT use emojis.

Icons only.

---

# Navigation

Keep navigation simple.

Sidebar Items:

```text
Dashboard

Ingredients

Products

Recipes

Sales

Expenses

Logout
```

Avoid nested menus.

Maximum depth:

```text
Sidebar
→ Page
→ Form
```

Never deeper.

---

# Dashboard Design

The dashboard should immediately answer:

* How much was earned?
* How much was spent?
* What sells best?
* What needs attention?

---

## Dashboard Cards

Display:

* Total Sales
* Total Expenses
* Net Profit
* Best Selling Product

---

## Secondary Widgets

Display:

* Recent Sales
* Recent Expenses
* Low Stock Ingredients

---

# Low Stock Alerts

Always display important inventory warnings.

Example:

```text
Low Stock Alert

Flour has only 2kg remaining.
```

---

# Forms

Forms must be easy for non-technical users.

---

## Every Input Requires Help Text

Example:

Ingredient Name

```text
Example: Flour
```

---

Cost Per Unit

```text
Example: ₱50 per kilogram
```

---

Quantity

```text
Example: 10kg available
```

---

## Validation

Validation must be immediate and understandable.

Bad:

```text
Invalid input.
```

Good:

```text
Price must be greater than 0.
```

---

# Tooltips

Every important field should support contextual help.

Use:

```text
Info Icon
```

Example:

Production Cost

```text
The total ingredient cost required to produce this item.
```

---

# Tables

All tables must include:

* Search
* Pagination
* Loading State
* Empty State

Optional:

* Sorting
* Filters

---

# Cards vs Tables

Prefer cards when displaying products.

Use tables for:

* Sales
* Expenses
* Ingredients

Use cards for:

* Products
* Featured Items
* Customer-facing content

---

# Loading States

Never display empty screens while data loads.

Use:

* Skeleton loaders
* Placeholder cards

Avoid:

* Large loading spinners

---

# Empty States

Every empty state should guide the user.

Bad:

```text
No Data Found
```

Good:

```text
No products available.

Create your first product to get started.
```

---

# Toast Notifications

Use:

```text
react-hot-toast
```

Success:

```ts
toast.success("Product created successfully")
```

Error:

```ts
toast.error("Failed to create product")
```

Do not use:

```js
alert()
```

---

# Mobile Experience

The system must be mobile-friendly.

Requirements:

* Responsive layouts
* Collapsible sidebar
* Touch-friendly buttons
* Horizontal table scrolling

---

# Public Website

The public website should be visually attractive and marketing-focused.

---

## Goals

Allow visitors to:

* Browse donut flavors
* View pricing
* See product images
* Learn about the brand

---

# Hero Section

Must contain:

* Strong headline
* Supporting description
* Product imagery
* Call-to-action button

Example:

```text
Freshly Made Donuts Every Day

Made with quality ingredients and crafted with care.
```

Buttons:

```text
View Flavors

Contact Us
```

---

# Product Showcase

Use large product cards.

Each card should display:

* Product Image
* Product Name
* Short Description
* Price

---

# Product Categories

Examples:

```text
Classic

Chocolate

Premium

Seasonal
```

---

# Image Usage

Images are critical.

Products should always have:

* High-quality photos
* Consistent image sizes
* Optimized loading

---

# Animations

Animations should enhance the experience.

Allowed:

* Fade transitions
* Hover effects
* Smooth scrolling
* Card interactions

Avoid:

* Excessive motion
* Distracting animations
* Heavy effects

---

# Accessibility

All forms must have:

* Labels
* Focus states
* Keyboard accessibility

Buttons must clearly indicate actions.

---

# Consistency Rules

Every page should follow the same structure:

```text
Page Header

Description

Primary Action Button

Filters

Content

Pagination
```

Users should never have to learn a different layout for each page.

---

# Final Principle

The system should feel like managing a modern donut shop.

Not accounting software.

Not enterprise software.

Every screen should be welcoming, intuitive, and visually aligned with the Rowszein's Delight brand.

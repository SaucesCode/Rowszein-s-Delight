# UI_UX_GUIDELINES.md

## Purpose

This document defines the user experience, visual design standards, and interface rules for the Rowszein's Delight Owner Panel.

Current scope:

* Owner Dashboard
* Ingredients Management
* Products Management
* Recipes Management
* Sales Management
* Expenses Management

The public customer website is NOT part of the current design phase and will be designed separately.

---

# Design Goal

The application should feel like:

* A modern donut shop management system
* Friendly and welcoming
* Easy for non-technical users
* Visually attractive
* Consistent and predictable

The application should NOT feel like:

* Accounting software
* ERP software
* Enterprise dashboards
* Developer tools

---

# Design Personality

Brand characteristics:

* Warm
* Sweet
* Playful
* Premium
* Elegant
* Friendly

Every screen should reinforce the feeling of managing a dessert business.

---

# Design Priorities

Priority order:

1. Ease of use
2. Clarity
3. Consistency
4. Mobile responsiveness
5. Visual appeal
6. Animations

---

# UI Framework

Required:

* shadcn/ui
* Tailwind CSS
* Lucide React

Do not introduce additional component libraries.

Avoid:

* Material UI
* Ant Design
* Chakra UI
* Bootstrap

---

# Shadcn First Rule

The project uses shadcn/ui as the primary component library.

Before creating a custom component:

1. Check if shadcn/ui already provides it.
2. Use the shadcn component directly whenever possible.
3. Only create custom components when they represent a reusable business or layout pattern.

Use directly from shadcn/ui:

* Button
* Input
* Textarea
* Select
* Dialog
* Sheet
* DropdownMenu
* Tooltip
* Popover
* Badge
* Table
* Tabs
* Card
* Skeleton

Do not create wrappers around existing shadcn components.

Bad:

```text
CustomButton
CustomInput
CustomCard
CustomDialog
```

Good:

```text
Button
Input
Card
Dialog
```

---

# Design System Components

Only create custom components when they represent business-specific UI.

Approved custom components:

```text
PageContainer
PageHeader

DashboardStatCard

ProductCard

LowStockAlert

EmptyState

FormHelpText
```

Custom components should add business value.

They should not simply wrap shadcn components.

---

# Color Palette

## Primary Pink

```css
#FF6FAE
```

Usage:

* Primary buttons
* Active navigation
* Highlights
* Focus states

---

## Soft Pink

```css
#FFD6E7
```

Usage:

* Card accents
* Section backgrounds
* Dashboard highlights

---

## Cream

```css
#FFF8F0
```

Usage:

* Application background

---

## Chocolate Brown

```css
#6B4226
```

Usage:

* Headings
* Important text

---

## White

```css
#FFFDFB
```

Usage:

* Cards
* Forms
* Containers

---

# Typography

Headings:

```text
Poppins
```

Body:

```text
Inter
```

No additional fonts allowed.

---

# Icon System

Use:

```text
Lucide React
```

Examples:

Dashboard:
LayoutDashboard

Ingredients:
Package

Products:
CakeSlice

Recipes:
BookOpen

Sales:
ShoppingCart

Expenses:
Receipt

Logout:
LogOut

---

# Emoji Policy

Emojis are strictly prohibited throughout the application.

Do not use emojis in:

* Navigation
* Buttons
* Cards
* Forms
* Dashboard Widgets
* Tables
* Empty States
* Alerts
* Notifications
* Headers
* Marketing Content

Bad:

```text
🍩 Products
💰 Sales
📦 Ingredients
```

Good:

```text
Package Products
ShoppingCart Sales
Receipt Expenses
```

Use Lucide React icons exclusively.

---

# Icon Consistency Rules

Only use:

```text
Lucide React
```

Never mix icon libraries.

Do not use:

* Emojis
* Font Awesome
* Heroicons
* Material Icons
* Bootstrap Icons

Every icon must come from Lucide React.

Consistency is more important than visual variety.

---

# AI Design Rule

When generating designs:

* Never use emojis.
* Always use Lucide React icons.
* Reuse existing patterns.
* Reuse existing components.
* Reuse existing layouts.
* Reuse existing spacing.

If no suitable icon exists, use text only.

---

# Owner Panel Layout

Layout is fixed.

All pages must use:

```text
Sidebar
Navbar
Page Header
Content
```

No alternative layouts.

---

# Sidebar Structure

```text
Dashboard

Ingredients

Products

Recipes

Sales

Expenses

Logout
```

Rules:

* No nested menus
* No collapsible groups
* No multi-level navigation

Maximum depth:

```text
Sidebar
→ Page
→ Form
```

---

# Dashboard Layout

The dashboard should immediately answer:

* How much was earned?
* How much was spent?
* What sells best?
* What requires attention?

---

## First Row

Display:

* Total Sales
* Total Expenses
* Net Profit
* Best Selling Product

---

## Second Row

Display:

* Sales Chart
* Expense Chart

---

## Third Row

Display:

* Recent Sales
* Recent Expenses
* Low Stock Ingredients

---

# Page Structure

Every management page must follow:

```text
Page Header

Description

Primary Action Button

Filters

Content

Pagination
```

No exceptions.

---

# Forms

Forms should be beginner-friendly.

Every field must include:

* Label
* Placeholder
* Helper Text
* Validation Message

---

Example

Ingredient Name

Helper Text:

```text
Example: Flour
```

Quantity

Helper Text:

```text
Example: 10 kilograms available
```

Cost Per Unit

Helper Text:

```text
Example: ₱50 per kilogram
```

---

# Tooltips

Important fields must provide additional explanation.

Use Lucide Info icon.

Example:

Production Cost

```text
The total ingredient cost required to produce one item.
```

---

# Validation Messages

Validation should be understandable.

Bad:

```text
Invalid input.
```

Good:

```text
Price must be greater than 0.
```

---

# Tables

Every table must include:

* Search
* Pagination
* Loading State
* Empty State

Optional:

* Filters
* Sorting

---

# Product Display

Products should use cards whenever possible.

Each card displays:

* Image
* Name
* Price
* Availability
* Quick Actions

Avoid large product tables.

---

# Empty States

Bad:

```text
No Data
```

Good:

```text
No products available.

Create your first product to get started.
```

---

# Loading States

Use:

* Skeletons
* Placeholder cards

Avoid:

* Full-page spinners

---

# Toast Notifications

Required:

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

Never use:

```js
alert()
```

---

# Responsive Design

Must support:

* Mobile
* Tablet
* Desktop

Requirements:

* Collapsible sidebar
* Touch-friendly buttons
* Horizontal table scrolling

---

# Animations

Animations should enhance the interface.

Allowed:

* Hover effects
* Fade transitions
* Smooth page transitions
* Card interactions

Avoid:

* Excessive motion
* Distracting effects

---

# Reusable Pattern Rule

Before creating a new component, verify:

1. Does shadcn already provide this?
2. Does an existing project component already solve this?
3. Will this appear in multiple places?

If the answer is no, do not create a reusable component.

Avoid component bloat.

---

# Consistency Rules

Always reuse existing:

* Buttons
* Cards
* Forms
* Tables
* Dialogs
* Layouts

Never create a new pattern if an existing one already solves the problem.

Consistency is more important than creativity.

---

# Future Public Website

The current design phase only covers:

```text
Owner Dashboard
Ingredients
Products
Recipes
Sales
Expenses
```

Do not design:

```text
Landing Page
Customer Catalog
Marketing Pages
Public Website
```

until the Owner Panel design system is finalized and approved.

---

# Final Rule

The owner should feel like they are managing a beautiful donut shop.

Not accounting software.

Not enterprise software.

Every screen should feel:

* Warm
* Simple
* Approachable
* Consistent
* Friendly
* Professional

Business owners should be able to understand the interface immediately without training.

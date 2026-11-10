# 🍩 Rowszein's Delight Management System

A business management system built for **Rowszein's Delight** to help manage products, ingredients, sales, expenses, and business performance.

## Overview

Rowszein's Delight Management System is a web application designed to simplify daily business operations for a dessert shop.

The system provides tools for managing donut flavors, tracking ingredient costs, recording sales and expenses, and monitoring overall profitability through an easy-to-use dashboard.

## Features

### Current MVP

* User Authentication
* Ingredient Management
* Product Management
* Recipe Management
* Sales Tracking
* Expense Tracking
* Profit Dashboard

## Goals

* Track business revenue and expenses
* Calculate product production costs
* Monitor profit and performance
* Organize products and recipes
* Simplify business record keeping

## Tech Stack

### Backend

* Django
* Django REST Framework
* PostgreSQL

### Frontend

* React
* Vite
* Tailwind CSS

## Development Status

🚧 Currently in development.

The project is being built incrementally, focusing on core business functionality before advanced features.

## Documentation

Project documentation can be found in the `docs/` folder.

Latest checkpoint: [Phase 1B.3 disposable database verification](docs/PHASE1B3_DATABASE_VERIFICATION_REPORT.md) on `codex/phase-1b3-disposable-verification`. PostgreSQL: 120 business tests, 93 security/operational passes (one SQLite-only skip), 28 concurrency tests and 33 browser checks pass. Frontend: 52 utility checks, build and focused lint pass. **SQLite authentication throttling fails closed with 503 because of a confirmed trigger-formatting defect.** The exact one-line migration correction and revised hash await owner approval; the approved migrations remain unchanged. Prior checkpoints/evidence are preserved, disposable targets are removed, and production/dependency/deployment validation remains unauthorized/outstanding. The package is incomplete and the application is not production-ready.

## License

This project is being developed for learning, portfolio, and business management purposes.

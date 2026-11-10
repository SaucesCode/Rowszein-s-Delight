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

Latest checkpoint: [Phase 1B.3 disposable database verification](docs/PHASE1B3_DATABASE_VERIFICATION_REPORT.md) is complete for owner review on `codex/phase-1b3-disposable-verification`. The explicitly approved one-line SQLite migration fix is committed at `b9957e0`. PostgreSQL: 120 business passes, 93 security/operational passes (one SQLite-only skip), 28 concurrency passes. SQLite: 103 business passes/17 PostgreSQL-only skips, 91 security/operational passes/3 PostgreSQL-only skips. Both engines pass the original 13 role and 26 CSRF requirements; each has 33 real-browser passes. Frontend: 52 utility checks, build and focused lint pass. All three original session/throttling blockers now have passing integrated evidence on both engines. Failed runs and prior checkpoints remain preserved; disposable targets are removed. STOP for review. Production, dependencies, infrastructure and deployment validation remain separate outstanding gates; the application is not production-ready.

## License

This project is being developed for learning, portfolio, and business management purposes.

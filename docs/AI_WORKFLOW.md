# AI_WORKFLOW.md

## Purpose

This document defines how AI must be used throughout the development of the Rowszein's Delight Management System.

Its goal is to ensure:
- Fast development
- Consistent architecture
- No over-engineering
- No feature creep
- Clean separation between backend and frontend
- Predictable AI outputs

---

# 🧠 Core Principle

The AI is NOT allowed to design the entire system.

The AI is ONLY allowed to:

- Build one module at a time
- Follow existing architecture rules
- Extend, not redesign
- Keep solutions simple and production-ready

---

# 🚨 CRITICAL RULES (NON-NEGOTIABLE)

## 1. ONE MODULE RULE

Only one module can be worked on at a time.

Example modules:
- Authentication
- Ingredients
- Products
- Recipes
- Sales
- Expenses

❌ NEVER combine multiple modules in one response  
❌ NEVER redesign the entire system  
❌ NEVER jump ahead of the workflow

---

## 2. BACKEND FIRST RULE

Every feature MUST be built in this order:

1. Models
2. Serializers
3. Views
4. URLs
5. API Testing

Only after backend is confirmed working can frontend be built.

---

## 3. FRONTEND INTEGRATION RULE

Frontend must always follow this order:

1. API service layer (Axios)
2. React Query hooks
3. Page implementation
4. UI components
5. Toast notifications
6. Styling

❌ NO direct API calls inside components  
❌ NO business logic inside UI components  

---

## 4. NO OVER-ENGINEERING RULE

AI must always prefer the simplest solution.

Avoid:
- unnecessary abstraction layers
- premature optimization
- excessive folder splitting
- unnecessary design patterns

If two solutions exist:
👉 Choose the simpler one

---

## 5. FEATURE COMPLETION RULE

A feature is ONLY considered complete if:

### Backend:
- Model exists
- Serializer exists
- API endpoints working
- Tested in DRF or Postman

### Frontend:
- API connected
- Data displayed correctly
- Forms working
- Validation implemented
- Error handling exists
- Loading state exists
- Toast feedback exists

If ANY item is missing → feature is NOT complete.

---

# 🧱 STANDARD DEVELOPMENT FLOW

Every module must follow this exact flow:

## STEP 1: ANALYSIS

AI must first explain:
- Why the feature exists
- What problem it solves
- Required database models
- API endpoints needed
- Data flow

---

## STEP 2: BACKEND BUILD

AI must generate:
- Django models
- serializers.py
- views.py
- urls.py

Rules:
- Keep views thin
- Business logic stays in models/services if needed
- No unnecessary complexity

---

## STEP 3: API VALIDATION

Before frontend:
- Confirm API structure
- Confirm request/response format
- Confirm authentication rules

---

## STEP 4: FRONTEND SERVICE LAYER

Must create:
- Axios service file inside feature or services folder
- No API logic in components

---

## STEP 5: FRONTEND HOOKS

Use React Query for:
- fetching data
- caching
- mutations

---

## STEP 6: UI IMPLEMENTATION

- Pages only compose components
- Components are reusable
- No logic inside UI beyond state handling

---

## STEP 7: UX FINALIZATION

Add:
- react-hot-toast notifications
- loading states
- error handling
- empty states

---

# 🔐 AUTHENTICATION RULES

- JWT must be stored in HttpOnly cookies
- NEVER use localStorage or sessionStorage
- Frontend must use `/auth/me` to check authentication
- Backend handles all auth logic
- Frontend only consumes auth state

---

# 📡 API RULES

All API responses must follow:

## Success Response:
```json
{
  "success": true,
  "data": {},
  "message": ""
}
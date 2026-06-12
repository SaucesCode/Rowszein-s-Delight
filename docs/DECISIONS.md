# DECISIONS

## 2026-06-10

Decision:

Use Django REST Framework.

Reason:

Best fit for React frontend and business applications.

---

Decision:

Use JWT Authentication.

Reason:

Works well with SPA architecture.

---

Decision:

Use PostgreSQL.

Reason:

Reliable relational database and scalable.

---

Decision:

Use React Query instead of Redux.

Reason:

Simpler server state management.

---

Decision:

Build Backend First.

Reason:

Business logic is more important than UI.

---

Decision:

Use Admin and Staff roles only.

Reason:

Keeps authorization simple during MVP development.

---

Decision:

Focus on MVP only.

Reason:

Finish core business features before adding advanced functionality.

---

## 2026-06-11

Decision:
Use HttpOnly cookies for JWT storage instead of localStorage.

Reason:
localStorage is vulnerable to XSS — any injected script can steal the token.
HttpOnly cookies are inaccessible to JavaScript entirely, eliminating that attack vector.
withCredentials: true on Axios sends cookies automatically on every request.
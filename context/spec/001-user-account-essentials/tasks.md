# Task List: User Account Essentials

- **Spec:** `context/spec/001-user-account-essentials/`
- **Approach:** Each slice is a complete vertical cut — runnable and testable before moving to the next.

---

## Slice 1: Project Scaffolding — All Services Start Up

*Goal: `docker-compose up` brings up auth-service, web-bff, frontend dev server, auth-db, and Redis without errors.*

- [x] Create the top-level monorepo directory structure: `services/auth-service/`, `services/web-bff/`, `frontend/` **[Agent: devops-infra]**
- [x] Scaffold `auth-service`: FastAPI app with `GET /health` returning `{"status": "ok"}`, Pydantic `BaseSettings` config, and a `Dockerfile` (multi-stage, non-root user) **[Agent: python-backend]**
- [x] Scaffold `web-bff`: FastAPI + Strawberry app with `GET /health` returning `{"status": "ok"}` and an empty GraphQL schema endpoint at `/graphql`, and a `Dockerfile` **[Agent: python-backend]**
- [x] Scaffold `frontend`: React + Vite + TypeScript SPA with a placeholder `App.tsx`, Apollo Client wired to `http://localhost:8001/graphql`, and React Router with a single `/` route **[Agent: react-frontend]**
- [x] Create root `docker-compose.yml` orchestrating: `auth-service` (port 8000), `web-bff` (port 8001), `auth-db` (PostgreSQL, port 5432), `redis` (port 6379), `frontend` dev server (port 5173) with hot reload volume mount **[Agent: devops-infra]**
- [x] Verify: Run `docker-compose up`. Confirm `GET http://localhost:8000/health` and `GET http://localhost:8001/health` both return `{"status": "ok"}`. Navigate browser to `http://localhost:5173` and confirm the React app loads without console errors. **[Agent: devops-infra]**

---

## Slice 2: Sign-Up — End-to-End

*Goal: A new user can fill the sign-up form, submit it, and land inside the app, automatically signed in.*

- [x] Create the initial Alembic migration for `auth-db` creating the `users` table with columns: `id` (UUID PK), `display_name` (TEXT NOT NULL), `email` (VARCHAR 255, UNIQUE NOT NULL), `password_hash` (TEXT NOT NULL), `pending_email` (VARCHAR 255, NULLABLE), `is_active` (BOOLEAN DEFAULT TRUE), `created_at`, `updated_at` (TIMESTAMPTZ) **[Agent: postgres-database]**
- [x] Implement `UserRepository` in `auth-service` with `create_user` and `get_by_email` async methods **[Agent: python-backend]**
- [x] Implement `core/security.py` in `auth-service`: `hash_password(plain)`, `verify_password(plain, hash)`, `create_access_token(payload)`, `decode_access_token(token)` **[Agent: python-backend]**
- [x] Implement `POST /internal/auth/register` in `auth-service`: validate input with Pydantic v2 schema, hash password with bcrypt, insert user, issue JWT access token (15 min) + opaque refresh token (UUID stored in Redis with 30-day TTL), set refresh token as `HttpOnly; SameSite=Strict` cookie, return `{user, access_token}` **[Agent: python-backend]**
- [x] Add `SignUpInput` input type and `signUp` mutation resolver to the BFF's Strawberry schema; resolver POSTs to `auth-service /internal/auth/register` and forwards the Set-Cookie header to the browser response **[Agent: python-backend]**
- [x] Build `SignUpPage` in the frontend (`/sign-up` route): form with display name, email, password, confirm password fields; inline password requirements checklist (8+ chars, uppercase, number) shown on focus and validated on `onChange`; "Passwords do not match" error shown on `onBlur` of confirm field; calls `signUp` Apollo mutation on submit **[Agent: react-frontend]**
- [x] On successful `signUp` response: store `accessToken` in the in-memory token store (`shared/lib/token-store`); redirect user to `/` (app home placeholder) **[Agent: react-frontend]**
- [x] Verify: Open browser to `http://localhost:5173/sign-up`. Fill in all fields with valid data and submit. Confirm redirect away from sign-up and that the BFF returned an access token in the response body and a `Set-Cookie` header for the refresh token (check DevTools Network tab). Attempt sign-up with a duplicate email and confirm the error message "An account with this email already exists" appears. **[Agent: react-frontend]**

---

## Slice 3: Sign-In, Token Refresh, Protected Routes & Lockout

*Goal: A registered user can sign in; the app silently refreshes the access token on reload; unauthenticated users are redirected; accounts lock after 5 failed attempts.*

- [x] Implement `RedisService` in `auth-service` with methods: `increment_login_attempts(email)`, `is_locked(email)`, `lock_account(email, ttl_seconds)`, `store_refresh_token(user_id, jti, ttl)`, `revoke_refresh_token(user_id, jti)` **[Agent: python-backend]**
- [x] Implement `POST /internal/auth/login` in `auth-service`: check lockout (return 423 if locked), verify email/password (return 401 on failure, increment counter, lock after 5), reset counter on success, issue access + refresh tokens **[Agent: python-backend]**
- [x] Implement `POST /internal/auth/logout` in `auth-service`: read refresh token from cookie, revoke its JTI in Redis, clear the cookie **[Agent: python-backend]**
- [x] Implement `POST /internal/auth/refresh` in `auth-service`: read refresh token from cookie, validate JTI exists in Redis, issue new access token, rotate refresh token (delete old JTI, store new one) **[Agent: python-backend]**
- [x] Add `signIn` and `signOut` mutations to the BFF Strawberry schema with resolvers calling the corresponding `auth-service` endpoints and forwarding cookies **[Agent: python-backend]**
- [x] Build `SignInPage` in the frontend (`/sign-in` route): email + password form; calls `signIn` mutation; on success stores access token and redirects to `/`; on 401 shows "Incorrect email or password"; on 423 shows "Account temporarily locked due to too many failed attempts. Please try again in 15 minutes." **[Agent: react-frontend]**
- [x] Set up Apollo Client auth link in `shared/api/apollo-client`: attach `Authorization: Bearer {token}` from the token store to every request; add a forward error link that on 401 silently calls the BFF refresh operation, stores the new access token, and retries the original operation; on refresh failure, clear the token store and redirect to `/sign-in` **[Agent: react-frontend]**
- [x] Implement a protected route wrapper (`shared/lib/router`): on mount, if no token in memory, attempt a silent token refresh via the BFF; if refresh fails, redirect to `/sign-in`; show a loading state while the refresh is in flight **[Agent: react-frontend]**
- [x] Verify: Sign in with correct credentials and confirm redirect to app. Enter a wrong password 5 times and confirm the lockout message appears and the form is disabled. Reload the page while signed in and confirm the session is restored silently (no redirect to sign-in). Navigate to a protected route while signed out and confirm redirect to `/sign-in`. **[Agent: react-frontend]**

---

## Slice 4: Password Reset via Email Link

*Goal: A user who forgets their password can request a reset link, receive it by email, and set a new password, landing back in the app automatically signed in.*

- [x] Implement `EmailService` in `auth-service` using the Resend SDK: `send_password_reset(to_email, reset_link)`, `send_email_change_confirmation(to_new_email, confirm_link)`, and `send_email_change_alert(to_old_email)` methods **[Agent: python-backend]**
- [x] Implement `POST /internal/auth/forgot-password` in `auth-service`: if email exists, generate a secure random token, store `auth:pwd_reset:{token} → user_id` in Redis with 1-hour TTL, send reset email via Resend; always return 200 regardless of whether the email exists **[Agent: python-backend]**
- [x] Implement `POST /internal/auth/reset-password` in `auth-service`: look up token in Redis, return 400 if missing/expired, delete token immediately on retrieval (single-use), hash new password, update user record, issue access + refresh tokens **[Agent: python-backend]**
- [x] Add `forgotPassword` and `resetPassword` mutations to the BFF Strawberry schema **[Agent: python-backend]**
- [x] Build `ForgotPasswordPage` (`/forgot-password` route): single email input; on submit calls `forgotPassword` mutation; always shows "If an account exists for this email, a reset link has been sent." regardless of the result **[Agent: react-frontend]**
- [x] Build `ResetPasswordPage` (`/reset-password` route): reads `?token=` from URL query params; new password + confirm fields with same inline validation; on submit calls `resetPassword` mutation; on success stores access token and redirects to `/`; on 400 shows "This reset link has expired or already been used. Please request a new one." with a link to `/forgot-password` **[Agent: react-frontend]**
- [x] Verify: Navigate to `/forgot-password`, enter a registered email, submit. Confirm the success message is shown. Inspect Resend logs to confirm the email was sent. Click the reset link in the email. Confirm `ResetPasswordPage` loads. Enter a new valid password and submit. Confirm auto-login and redirect to app. Attempt to use the same reset link again and confirm the expired/used error message. **[Agent: react-frontend]**

---

## Slice 5: Profile Page — View Current User & Default Avatar

*Goal: A signed-in user can navigate to `/profile` and see their display name, email, and a default avatar (first letter of their display name).*

- [x] Implement `GET /internal/auth/me` in `auth-service`: extract user ID from the JWT via a `get_current_user` FastAPI dependency; return `{id, display_name, email, pending_email, created_at}` **[Agent: python-backend]**
- [x] Add `me: User` query to the BFF Strawberry schema; resolver calls `GET /internal/auth/me` forwarding the `Authorization` header **[Agent: python-backend]**
- [x] Create `entities/user` in the frontend: `User` TypeScript type and `useCurrentUser` Apollo hook wrapping the `me` query **[Agent: react-frontend]**
- [x] Build `ProfilePage` (`/profile` route, protected): displays the user's display name and email address; shows a circular default avatar containing the uppercased first letter of `displayName` styled with a background colour; uses the protected route wrapper **[Agent: react-frontend]**
- [x] Verify: Sign in, navigate to `http://localhost:5173/profile`. Confirm display name, email, and the initial-letter avatar are displayed correctly. Navigate to `/profile` in a new tab without being signed in and confirm redirect to `/sign-in`. **[Agent: react-frontend]**

---

## Slice 6: Profile — Change Display Name & Change Password

*Goal: A signed-in user can update their display name and change their password directly from the profile page.*

- [x] Implement `PATCH /internal/auth/me/profile` in `auth-service`: validate `display_name` is not empty; update the user record; return updated user **[Agent: python-backend]**
- [x] Implement `POST /internal/auth/me/change-password` in `auth-service`: verify `current_password` against the stored hash (return 401 if wrong); validate new password meets requirements (8+ chars, uppercase, number); update password hash; return 200; other sessions remain active **[Agent: python-backend]**
- [x] Add `updateProfile(input: UpdateProfileInput!)` and `changePassword(input: ChangePasswordInput!)` mutations to the BFF Strawberry schema **[Agent: python-backend]**
- [x] Add an inline editable display name section to `ProfilePage`: shows current name with an "Edit" button; clicking reveals a text input pre-filled with the current name and Save/Cancel actions; on save calls `updateProfile` mutation and immediately updates the displayed name and avatar initial **[Agent: react-frontend]**
- [x] Add a change-password section to `ProfilePage`: current password field + new password + confirm new password; inline validation same as sign-up; calls `changePassword` mutation; on success shows "Password updated successfully"; on 401 shows "Current password is incorrect" **[Agent: react-frontend]**
- [x] Verify: On the profile page, edit the display name and confirm it updates in the header and avatar letter immediately. In the change-password form, enter the wrong current password and confirm the error message. Enter the correct current password with a valid new password and confirm the success message. Sign out, sign in with the new password, and confirm access. **[Agent: react-frontend]**

---

## Slice 7: Profile — Change Email with Confirmation & Security Alert

*Goal: A user can request an email address change; the new email receives a confirmation link; the old email receives a security alert; the change only takes effect after the confirmation link is clicked.*

- [x] Implement `POST /internal/auth/me/change-email` in `auth-service`: validate new email format and uniqueness (return 409 if taken); generate a confirmation token; store `auth:email_change:{token} → {user_id}:{new_email}` in Redis with 24-hour TTL; set `pending_email` on the user record; send confirmation link to new email via Resend; send security alert to current email via Resend; return 200 **[Agent: python-backend]**
- [x] Implement `GET /internal/auth/confirm-email?token=` in `auth-service` (publicly accessible via BFF): look up token in Redis, return 400 if missing/expired, delete token immediately, update `email` to `pending_email`, clear `pending_email`, return updated user **[Agent: python-backend]**
- [x] Add `changeEmail(newEmail: String!): Boolean!` mutation and `confirmEmailChange(token: String!): User!` mutation to the BFF Strawberry schema; also add `pendingEmail` field to the `User` type **[Agent: python-backend]**
- [x] Add a change-email section to `ProfilePage`: displays current email address; if `pendingEmail` is set, shows a notice "A confirmation link has been sent to [pendingEmail]. Click it to complete the change."; input field to enter a new email address; on submit calls `changeEmail` mutation and shows the pending notice **[Agent: react-frontend]**
- [x] Add `/confirm-email` route in the frontend: reads `?token=` from URL; calls `confirmEmailChange` mutation; on success shows "Your email address has been updated." with a link back to `/profile`; on 400 shows "This confirmation link has expired or already been used." **[Agent: react-frontend]**
- [x] Verify: On the profile page, submit a new email address. Confirm the pending notice appears. Inspect Resend logs to confirm two emails were sent (confirmation to new address, security alert to old address). Click the confirmation link. Confirm the profile now shows the new email and the pending notice is gone. Sign out and sign in with the new email address to confirm it is now the active login. **[Agent: react-frontend]**

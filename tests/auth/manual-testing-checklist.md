# ERP Nexus Authentication - Manual Testing Checklist

## Pre-Testing Setup

### Environment Preparation
- [ ] Backend API is running on `http://localhost:5000`
- [ ] Frontend is running on `http://localhost:3000`
- [ ] Browser DevTools are open (Console + Network tabs)
- [ ] Clear all browser storage before each test:
  ```javascript
  localStorage.clear();
  sessionStorage.clear();
  // Also clear cookies if needed
  ```

### Debugging Tools Setup
- [ ] Enable verbose logging in browser console:
  ```javascript
  // Run in console to monitor auth state
  function watchAuthState() {
    setInterval(() => {
      const authState = JSON.parse(localStorage.getItem('erp-nexus-auth') || '{}');
      console.table({
        'Token': localStorage.getItem('erp_nexus_token') ? 'Present' : 'Missing',
        'Refresh Token': localStorage.getItem('erp_nexus_refresh_token') ? 'Present' : 'Missing',
        'Is Authenticated': authState.state?.isAuthenticated || false,
        'Status': authState.state?.status || 'unknown',
        'Is Initialized': authState.state?.isInitialized || false,
        'Current URL': window.location.pathname
      });
    }, 2000);
  }
  watchAuthState();
  ```

## Test Scenarios

### Scenario 1: Fresh User Visit (CRITICAL)
**Objective**: Ensure fresh users see login form quickly without getting stuck

#### Steps:
1. [ ] Clear all browser storage
2. [ ] Navigate to `http://localhost:3000/`
3. [ ] Start timer

#### Expected Results:
- [ ] **Within 2 seconds**: Should redirect to `/login`
- [ ] **Within 3 seconds**: Login form should be visible
- [ ] **Never**: Should not show "Verificando autenticação..." for more than 2 seconds
- [ ] **Never**: Should not show infinite loading spinner

#### Current Broken Behavior to Watch For:
- ❌ Gets stuck on "Verificando autenticação..."
- ❌ Shows loading spinner indefinitely
- ❌ Never reaches `/login` page

#### Debugging If Failed:
```javascript
// Check auth store state
console.log('Auth Store:', useAuthStore.getState());
// Check AuthProvider state
console.log('AuthProvider ready:', document.querySelector('[data-testid="test-content"]') !== null);
```

---

### Scenario 2: Direct Login Page Access
**Objective**: Ensure login page loads immediately when accessed directly

#### Steps:
1. [ ] Clear all browser storage
2. [ ] Navigate directly to `http://localhost:3000/login`

#### Expected Results:
- [ ] **Immediately**: Should stay on `/login` (no redirect)
- [ ] **Within 1 second**: Login form should be visible
- [ ] **Form elements present**:
  - [ ] Email input field
  - [ ] Password input field
  - [ ] Submit button
  - [ ] ERP Nexus branding

#### Common Issues to Check:
- [ ] Form takes too long to render
- [ ] AuthProvider blocking form display
- [ ] Missing form validation attributes

---

### Scenario 3: Login Form Functionality
**Objective**: Test actual login process works correctly

#### Test Case 3.1: Valid Credentials
##### Steps:
1. [ ] Navigate to `/login`
2. [ ] Enter valid credentials:
   - Email: `admin@erpnexus.com`
   - Password: `admin123`
3. [ ] Click "Entrar" button
4. [ ] Monitor Network tab for API calls

##### Expected Results:
- [ ] **Submit button shows loading state**: "Entrando..."
- [ ] **API call made**: POST to `/api/auth/login`
- [ ] **Within 5 seconds**: Redirect to `/dashboard`
- [ ] **Token stored**: Check `localStorage.getItem('erp_nexus_token')`
- [ ] **Auth state updated**: User should be marked as authenticated

#### Test Case 3.2: Invalid Credentials
##### Steps:
1. [ ] Navigate to `/login`
2. [ ] Enter invalid credentials:
   - Email: `invalid@example.com`
   - Password: `wrongpassword`
3. [ ] Click "Entrar" button

##### Expected Results:
- [ ] **Error message displayed**: "Credenciais inválidas" or similar
- [ ] **Stay on login page**: Should not redirect
- [ ] **Form remains functional**: Can try again
- [ ] **No infinite loading**: Loading state should end

#### Test Case 3.3: Empty Form Validation
##### Steps:
1. [ ] Navigate to `/login`
2. [ ] Click "Entrar" without filling fields

##### Expected Results:
- [ ] **HTML5 validation**: Browser should show required field messages
- [ ] **No form submission**: Should not make API call
- [ ] **Form stays accessible**: Can continue to fill fields

---

### Scenario 4: Authenticated User Navigation
**Objective**: Test authenticated users can access protected routes

#### Setup:
```javascript
// Run in console to simulate authenticated state
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Valid JWT
localStorage.setItem('erp_nexus_token', mockToken);
localStorage.setItem('erp_nexus_refresh_token', 'refresh_token');

// Set auth state
const authState = {
  state: {
    user: { email: 'admin@erpnexus.com', name: 'Admin User' },
    token: mockToken,
    isAuthenticated: true,
    status: 'authenticated',
    isInitialized: true
  }
};
localStorage.setItem('erp-nexus-auth', JSON.stringify(authState));
```

#### Test Cases:
1. [ ] **Root access**: Navigate to `/` → Should redirect to `/dashboard`
2. [ ] **Direct dashboard**: Navigate to `/dashboard` → Should load immediately
3. [ ] **Protected routes**: Navigate to `/crm`, `/settings` → Should load without auth checks
4. [ ] **Login page**: Navigate to `/login` → Should redirect to `/dashboard`

#### Expected Results:
- [ ] **No loading delays**: Pages should load immediately
- [ ] **No auth verification prompts**: Should trust stored token
- [ ] **Proper redirects**: Login page should redirect away

---

### Scenario 5: Protected Route Access (Unauthenticated)
**Objective**: Ensure unauthenticated users are redirected to login

#### Steps:
1. [ ] Clear all browser storage
2. [ ] Navigate directly to protected routes:
   - `/dashboard`
   - `/crm`
   - `/settings`
   - `/reports`

#### Expected Results for Each Route:
- [ ] **Redirect to `/login`**: Should happen within 3 seconds
- [ ] **Original URL stored**: Check `sessionStorage.getItem('redirectAfterLogin')`
- [ ] **Login form accessible**: Can proceed with login

#### Post-Login Redirect Test:
1. [ ] After redirect to login, log in with valid credentials
2. [ ] Should redirect back to originally requested URL

---

### Scenario 6: Auth State Transitions
**Objective**: Monitor auth state changes during different operations

#### Monitoring Setup:
```javascript
// Add to console for real-time monitoring
const originalConsoleLog = console.log;
console.log = function(...args) {
  if (args[0]?.includes?.('Auth') || args[0]?.includes?.('HomePage')) {
    originalConsoleLog.apply(console, ['🔍 AUTH LOG:', ...args]);
  } else {
    originalConsoleLog.apply(console, args);
  }
};
```

#### Test Flow:
1. [ ] **Fresh start**: Clear storage → Should see initialization logs
2. [ ] **Login**: Submit credentials → Should see login transition logs
3. [ ] **Navigation**: Move between pages → Should see auth checks
4. [ ] **Logout**: Clear auth → Should see cleanup logs

#### Expected Log Sequence:
```
🔍 AUTH LOG: 🔄 Starting auth store initialization...
🔍 AUTH LOG: ❌ No valid tokens found, setting as unauthenticated
🔍 AUTH LOG: ❌ HomePage: Usuário não autenticado, redirecionando para login
🔍 AUTH LOG: ✅ Login successful: admin@erpnexus.com
🔍 AUTH LOG: ✅ HomePage: Usuário autenticado, redirecionando para dashboard
```

---

### Scenario 7: Token Refresh Behavior
**Objective**: Test automatic token refresh doesn't interrupt user experience

#### Setup Expired Token:
```javascript
// Create a token that expires soon
const nearExpiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwODJ9.xyz'; // Expires in 60 seconds
localStorage.setItem('erp_nexus_token', nearExpiredToken);
localStorage.setItem('erp_nexus_refresh_token', 'valid_refresh_token');
```

#### Test Steps:
1. [ ] Set up near-expired token (see above)
2. [ ] Navigate to `/dashboard`
3. [ ] Wait for automatic refresh (should happen before expiry)
4. [ ] Monitor Network tab for refresh API calls

#### Expected Results:
- [ ] **Background refresh**: Should happen automatically
- [ ] **No user interruption**: Dashboard should remain accessible
- [ ] **Token updated**: New token should replace old one in storage
- [ ] **Seamless experience**: No loading screens or redirects

---

### Scenario 8: Error Handling & Recovery
**Objective**: Ensure app handles errors gracefully

#### Test Case 8.1: Network Failures
1. [ ] Disconnect internet/block API endpoints
2. [ ] Try to access `/dashboard`
3. [ ] Should show meaningful error or fallback gracefully

#### Test Case 8.2: Corrupted Storage
1. [ ] Set invalid data:
   ```javascript
   localStorage.setItem('erp_nexus_token', 'not-a-jwt-token');
   localStorage.setItem('erp-nexus-auth', 'invalid-json-{');
   ```
2. [ ] Navigate to `/`
3. [ ] Should clear corrupted data and redirect to login

#### Test Case 8.3: API Errors
1. [ ] Submit login with valid format but non-existent user
2. [ ] Should show specific error message
3. [ ] Should allow retry without page refresh

---

## Performance Benchmarks

### Loading Speed Tests
- [ ] **Fresh page load**: Root to login should complete in < 3 seconds
- [ ] **Login form display**: Should appear in < 1 second
- [ ] **Login submission**: Should respond in < 5 seconds
- [ ] **Authenticated navigation**: Pages should load in < 2 seconds

### Memory Usage
- [ ] **No memory leaks**: Multiple navigation shouldn't increase memory significantly
- [ ] **Event cleanup**: No console errors about memory issues

---

## Browser Compatibility

### Test in Multiple Browsers:
- [ ] **Chrome/Chromium**: Latest version
- [ ] **Firefox**: Latest version
- [ ] **Safari**: Latest version (if available)
- [ ] **Edge**: Latest version

### Mobile Testing:
- [ ] **Mobile Chrome**: Test responsive design
- [ ] **Mobile Safari**: iOS testing
- [ ] **Touch interactions**: Form inputs should work on mobile

---

## Common Issues & Debugging

### Issue 1: Infinite Loading Loop
**Symptoms**: "Verificando autenticação..." never disappears

**Debugging Steps**:
```javascript
// Check auth store initialization
console.log('Auth initialized?', useAuthStore.getState().isInitialized);
console.log('Auth loading?', useAuthStore.getState().isLoading);
console.log('Auth status?', useAuthStore.getState().status);
```

**Likely Causes**:
- AuthProvider not transitioning from loading state
- Auth store initialization hanging
- Invalid token causing validation loop

---

### Issue 2: Login Form Not Appearing
**Symptoms**: Stuck on loading screen when should show login

**Debugging Steps**:
```javascript
// Check route and auth state
console.log('Current route:', window.location.pathname);
console.log('AuthProvider ready?', /* check if AuthProvider is ready */);
console.log('withAuth status:', /* check withAuth component state */);
```

**Likely Causes**:
- withAuth HOC blocking render
- AuthProvider stuck in loading state
- Route protection logic error

---

### Issue 3: Failed Login Redirects
**Symptoms**: Login succeeds but doesn't redirect properly

**Debugging Steps**:
```javascript
// Check auth state after login
console.log('Post-login auth state:', useAuthStore.getState());
console.log('Stored tokens:', {
  token: localStorage.getItem('erp_nexus_token'),
  refresh: localStorage.getItem('erp_nexus_refresh_token')
});
```

**Likely Causes**:
- Token not properly stored
- Auth state not updating after login
- Router navigation failing

---

## Success Criteria

### Must Pass:
- [ ] Fresh user sees login form within 3 seconds
- [ ] Valid login redirects to dashboard within 5 seconds
- [ ] Invalid login shows error without breaking form
- [ ] Authenticated users can access all protected routes
- [ ] Unauthenticated users are redirected to login
- [ ] No infinite loading states anywhere
- [ ] Token refresh works seamlessly

### Should Pass:
- [ ] All performance benchmarks met
- [ ] Works in all major browsers
- [ ] Mobile responsive
- [ ] Accessible with keyboard navigation
- [ ] No console errors during normal flow

### Could Pass (Nice to Have):
- [ ] Remembers form inputs on validation errors
- [ ] Shows meaningful loading messages
- [ ] Handles network errors gracefully
- [ ] Auto-focuses form fields appropriately

---

## Test Result Documentation

### Template for Recording Results:

```
## Test Session: [Date/Time]
**Environment**: [Browser, OS, Backend Version]
**Tester**: [Name]

### Scenario 1: Fresh User Visit
- Status: ✅ Pass / ❌ Fail
- Time to login form: [X.X] seconds
- Notes: [Any observations]

### Scenario 2: Login Functionality
- Valid login: ✅ Pass / ❌ Fail
- Invalid login: ✅ Pass / ❌ Fail
- Notes: [Any issues found]

[Continue for all scenarios...]

### Overall Assessment:
- Ready for production: Yes/No
- Critical issues found: [List]
- Recommendations: [Suggestions]
```

---

This comprehensive manual testing checklist should identify all authentication flow issues and validate that the fixes work correctly end-to-end.
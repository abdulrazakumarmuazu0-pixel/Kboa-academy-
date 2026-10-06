# Authorization Launch Checklist

- [ ] Every privileged callable has a capability check.
- [ ] Resource ownership is checked after capability authorization.
- [ ] Admin permission changes require recent authentication.
- [ ] No client can write roles, permissions, audit logs, security events, payments, or certificates directly.
- [ ] Existing users have valid role claims.
- [ ] Changed claims have been refreshed on active sessions.
- [ ] Authorization denial monitoring is enabled.
- [ ] Security regression suite passes in CI.

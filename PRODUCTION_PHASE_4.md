# KBOA Academy — Production Phase 4

## Delivered
- Trusted push-token registration/removal through callable Functions.
- FCM multicast notification delivery with invalid-token cleanup.
- In-app notification records with server-only writes.
- Notification read state through a trusted callable.
- Automatic admission-status notifications.
- Admin notification sending UI.
- XP read API with level calculation and recent XP events.
- Android native bridge migrated away from direct privileged token writes.
- Firestore rules deny client writes to notification/token collections.
- Static Phase 4 production checks.

## Production prerequisites
- Configure Firebase Cloud Messaging for Android and upload the correct Firebase Android configuration.
- Ensure Functions have permission to send FCM messages.
- Configure Android notification channel `kboa_default` in the native application.
- Run Firebase Emulator security tests before production deployment.
- Verify FCM delivery on a physical Android device.

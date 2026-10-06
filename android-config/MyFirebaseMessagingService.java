package ng.edu.kboa.app;

import android.util.Log;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "KBOA_FCM";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Log the message
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // Handle notification payload (app in foreground)
        if (remoteMessage.getNotification() != null) {
            String title = remoteMessage.getNotification().getTitle();
            String body = remoteMessage.getNotification().getBody();

            showNotification(title, body, remoteMessage.getData());
        }

        // Handle data payload (app in background)
        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "Message data payload: " + remoteMessage.getData());

            String type = remoteMessage.getData().get("type");
            // type: new_lesson, assignment_due, live_class, certificate
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token);

        // Token is also handled by the JS bridge via Capacitor listener
        // This service handles background token refreshes
    }

    private void showNotification(String title, String body, java.util.Map<String, String> data) {
        // Notification building handled by Capacitor PushNotifications plugin
        // This method exists for custom handling if needed
    }
}

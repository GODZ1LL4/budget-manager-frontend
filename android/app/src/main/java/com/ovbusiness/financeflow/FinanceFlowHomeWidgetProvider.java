package com.ovbusiness.financeflow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class FinanceFlowHomeWidgetProvider extends AppWidgetProvider {
    private static final String PREFERENCES_GROUP = "CapacitorStorage";
    private static final String SNAPSHOT_KEY = "bm_home_widget_snapshot_v1";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void refreshAll(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, FinanceFlowHomeWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.widget_cards_list);
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.widget_cards_list);
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.financeflow_home_widget);
            JSONObject snapshot = getSnapshot(context);

            views.setTextViewText(R.id.widget_title, snapshot.optString("title", "FinanceFlow"));
            views.setTextViewText(R.id.widget_subtitle, snapshot.optString("subtitle", "Resumen rapido"));
            views.setTextViewText(R.id.widget_balance_label, snapshot.optString("balanceLabel", "Balance actual"));
            views.setTextViewText(R.id.widget_balance_value, snapshot.optString("balanceValue", "--"));
            views.setTextViewText(R.id.widget_updated_label, snapshot.optString("updatedLabel", "Sin datos recientes"));

            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Intent adapterIntent = new Intent(context, FinanceFlowHomeWidgetService.class);
            adapterIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            adapterIntent.putExtra("snapshot_refresh_token", System.currentTimeMillis());
            adapterIntent.setData(Uri.parse(adapterIntent.toUri(Intent.URI_INTENT_SCHEME)));

            views.setRemoteAdapter(R.id.widget_cards_list, adapterIntent);
            views.setEmptyView(R.id.widget_cards_list, R.id.widget_empty_cards);
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
            views.setPendingIntentTemplate(R.id.widget_cards_list, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_cards_list);
        } catch (Exception ignored) {
        }
    }

    static JSONObject getSnapshot(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_GROUP, Context.MODE_PRIVATE);
        String raw = preferences.getString(SNAPSHOT_KEY, null);

        if (raw == null || raw.isEmpty()) {
            return new JSONObject();
        }

        try {
            return new JSONObject(raw);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }
}

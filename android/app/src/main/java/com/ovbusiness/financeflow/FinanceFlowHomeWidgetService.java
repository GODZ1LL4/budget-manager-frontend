package com.ovbusiness.financeflow;

import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONArray;
import org.json.JSONObject;

public class FinanceFlowHomeWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsService.RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new HomeWidgetCardsFactory(getApplicationContext());
    }

    private static class HomeWidgetCardsFactory implements RemoteViewsService.RemoteViewsFactory {
        private static final int TEXT_COLOR = 0xFFFFF5D6;
        private static final int MUTED_COLOR = 0xFFCBB98C;
        private static final int GOLD_COLOR = 0xFFFFD76E;
        private static final int SOFT_GOLD_COLOR = 0xFFFFE7A3;
        private static final int DEEP_GOLD_COLOR = 0xFFB69B55;

        private final Context context;
        private JSONObject snapshot = new JSONObject();
        private JSONArray accounts = new JSONArray();

        HomeWidgetCardsFactory(Context context) {
            this.context = context;
        }

        @Override
        public void onCreate() {
            loadSnapshot();
        }

        @Override
        public void onDataSetChanged() {
            loadSnapshot();
        }

        @Override
        public void onDestroy() {
            snapshot = new JSONObject();
            accounts = new JSONArray();
        }

        @Override
        public int getCount() {
            return 2 + Math.max(accounts.length(), 1);
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.financeflow_home_widget_card);
            views.setOnClickFillInIntent(R.id.widget_card_root, new Intent());

            if (position == 0) {
                bindCard(
                    views,
                    "Gasto",
                    snapshot.optString("expenseLabel", "Gasto del mes"),
                    snapshot.optString("expenseValue", "--"),
                    "Este mes",
                    SOFT_GOLD_COLOR
                );
                return views;
            }

            if (position == 1) {
                bindCard(
                    views,
                    "Ingreso",
                    snapshot.optString("incomeLabel", "Ingreso del mes"),
                    snapshot.optString("incomeValue", "--"),
                    "Este mes",
                    GOLD_COLOR
                );
                return views;
            }

            int accountIndex = position - 2;
            if (accounts.length() <= 0) {
                bindCard(
                    views,
                    snapshot.optString("accountSectionLabel", "Cuentas"),
                    "Sin cuentas",
                    "--",
                    "Abre la app para cargar datos",
                    MUTED_COLOR
                );
                return views;
            }

            JSONObject account = accounts.optJSONObject(accountIndex);
            if (account == null) {
                account = new JSONObject();
            }

            String typeLabel = account.optString("typeLabel", "Cuenta");
            String kicker = "Cuenta " + (accountIndex + 1);
            if (!typeLabel.isEmpty() && !"Cuenta".equalsIgnoreCase(typeLabel)) {
                kicker = kicker + " - " + typeLabel;
            }

            bindCard(
                views,
                kicker,
                account.optString("name", "Cuenta"),
                account.optString("currentLabel", "--"),
                account.optString("footerLabel", "--"),
                GOLD_COLOR
            );
            return views;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }

        private void loadSnapshot() {
            snapshot = FinanceFlowHomeWidgetProvider.getSnapshot(context);
            JSONArray snapshotAccounts = snapshot.optJSONArray("accounts");
            accounts = snapshotAccounts != null ? snapshotAccounts : new JSONArray();
        }

        private void bindCard(
            RemoteViews views,
            String kicker,
            String title,
            String value,
            String footer,
            int valueColor
        ) {
            views.setTextViewText(R.id.widget_card_kicker, kicker);
            views.setTextViewText(R.id.widget_card_title, title);
            views.setTextViewText(R.id.widget_card_value, value);
            views.setTextViewText(R.id.widget_card_footer, footer);
            views.setTextColor(R.id.widget_card_kicker, DEEP_GOLD_COLOR);
            views.setTextColor(R.id.widget_card_title, TEXT_COLOR);
            views.setTextColor(R.id.widget_card_value, valueColor);
            views.setTextColor(R.id.widget_card_footer, MUTED_COLOR);
        }
    }
}

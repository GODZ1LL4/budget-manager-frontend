package com.ovbusiness.financeflow;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GooglePlayBillingPlugin.class);
        registerPlugin(HomeWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        FinanceFlowHomeWidgetProvider.refreshAll(this);
    }

    @Override
    public void onPause() {
        FinanceFlowHomeWidgetProvider.refreshAll(this);
        super.onPause();
    }
}

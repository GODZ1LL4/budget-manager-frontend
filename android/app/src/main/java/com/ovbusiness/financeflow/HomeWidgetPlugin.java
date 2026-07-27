package com.ovbusiness.financeflow;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "HomeWidget")
public class HomeWidgetPlugin extends Plugin {
    @PluginMethod
    public void refresh(PluginCall call) {
        FinanceFlowHomeWidgetProvider.refreshAll(getContext());

        JSObject result = new JSObject();
        result.put("refreshed", true);
        call.resolve(result);
    }
}

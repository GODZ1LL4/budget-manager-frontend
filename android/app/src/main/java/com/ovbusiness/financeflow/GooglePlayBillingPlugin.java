package com.ovbusiness.financeflow;

import android.text.TextUtils;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "GooglePlayBilling")
public class GooglePlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;
    private final List<PendingAction> pendingActions = new ArrayList<>();
    private boolean isConnecting = false;

    private static class PendingAction {
        private final PluginCall call;
        private final Runnable action;

        private PendingAction(PluginCall call, Runnable action) {
            this.call = call;
            this.action = action;
        }
    }

    @Override
    public void load() {
        super.load();
        createBillingClient();
        startConnectionIfNeeded();
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) {
            billingClient.endConnection();
            billingClient = null;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", billingClient != null && billingClient.isReady());
        call.resolve(result);
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        String productType = normalizeProductType(call.getString("productType"));
        JSArray productIds = call.getArray("productIds");

        if (productIds == null || productIds.length() == 0) {
            call.reject("productIds es obligatorio");
            return;
        }

        withBillingClient(call, () -> {
            try {
                List<QueryProductDetailsParams.Product> products = new ArrayList<>();

                for (int index = 0; index < productIds.length(); index++) {
                    String productId = productIds.getString(index);
                    if (TextUtils.isEmpty(productId)) {
                        continue;
                    }

                    products.add(
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(productId)
                            .setProductType(productType)
                            .build()
                    );
                }

                if (products.isEmpty()) {
                    call.reject("No se recibieron productIds validos");
                    return;
                }

                QueryProductDetailsParams params =
                    QueryProductDetailsParams.newBuilder()
                        .setProductList(products)
                        .build();

                billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
                    if (!isOk(billingResult)) {
                        call.reject(getBillingMessage(billingResult));
                        return;
                    }

                    JSArray items = new JSArray();

                    for (ProductDetails details : productDetailsList) {
                        items.put(serializeProductDetails(details, productType));
                    }

                    JSObject result = new JSObject();
                    result.put("products", items);
                    call.resolve(result);
                });
            } catch (JSONException exception) {
                call.reject("No se pudieron leer los productos", exception);
            }
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        String offerToken = call.getString("offerToken");
        String productType = normalizeProductType(call.getString("productType"));

        if (TextUtils.isEmpty(productId)) {
            call.reject("productId es obligatorio");
            return;
        }

        withBillingClient(call, () -> queryAndLaunchPurchase(call, productId, offerToken, productType));
    }

    @PluginMethod
    public void getPurchases(PluginCall call) {
        String productType = normalizeProductType(call.getString("productType"));

        withBillingClient(call, () -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(productType)
                .build();

            billingClient.queryPurchasesAsync(params, (billingResult, purchasesList) -> {
                if (!isOk(billingResult)) {
                    call.reject(getBillingMessage(billingResult));
                    return;
                }

                JSArray purchases = new JSArray();
                for (Purchase purchase : purchasesList) {
                    purchases.put(serializePurchase(purchase));
                }

                JSObject result = new JSObject();
                result.put("purchases", purchases);
                call.resolve(result);
            });
        });
    }

    @PluginMethod
    public void acknowledgePurchase(PluginCall call) {
        String purchaseToken = call.getString("purchaseToken");

        if (TextUtils.isEmpty(purchaseToken)) {
            call.reject("purchaseToken es obligatorio");
            return;
        }

        withBillingClient(call, () -> {
            AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchaseToken)
                .build();

            AcknowledgePurchaseResponseListener listener = billingResult -> {
                if (!isOk(billingResult)) {
                    call.reject(getBillingMessage(billingResult));
                    return;
                }

                JSObject result = new JSObject();
                result.put("acknowledged", true);
                call.resolve(result);
            };

            billingClient.acknowledgePurchase(params, listener);
        });
    }

    @PluginMethod
    public void openRedeemCode(PluginCall call) {
        String code = call.getString("code");
        String redeemUrl = TextUtils.isEmpty(code)
            ? "https://play.google.com/redeem"
            : "https://play.google.com/redeem?code=" + Uri.encode(code);
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(redeemUrl));
        intent.setPackage("com.android.vending");

        try {
            if (getActivity() != null) {
                getActivity().startActivity(intent);
            } else {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
        } catch (ActivityNotFoundException exception) {
            Intent fallbackIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(redeemUrl));
            try {
                if (getActivity() != null) {
                    getActivity().startActivity(fallbackIntent);
                } else {
                    fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallbackIntent);
                }
            } catch (Exception fallbackException) {
                call.reject("No se pudo abrir Google Play para canjear el codigo", fallbackException);
                return;
            }
        }

        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (pendingPurchaseCall == null) {
            return;
        }

        PluginCall activeCall = pendingPurchaseCall;
        pendingPurchaseCall = null;

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            activeCall.reject("La compra fue cancelada por el usuario");
            return;
        }

        if (!isOk(billingResult)) {
            activeCall.reject(getBillingMessage(billingResult));
            return;
        }

        if (purchases == null || purchases.isEmpty()) {
            activeCall.reject("Google Play no devolvio una compra");
            return;
        }

        Purchase purchase = purchases.get(0);
        JSObject result = new JSObject();
        result.put("purchase", serializePurchase(purchase));
        activeCall.resolve(result);
    }

    private void createBillingClient() {
        if (billingClient != null) {
            return;
        }

        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .build();
    }

    private void startConnectionIfNeeded() {
        createBillingClient();

        if (billingClient == null || billingClient.isReady() || isConnecting) {
            return;
        }

        isConnecting = true;
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                isConnecting = false;

                if (isOk(billingResult)) {
                    flushPendingActions();
                    return;
                }

                rejectPendingActions(getBillingMessage(billingResult));
            }

            @Override
            public void onBillingServiceDisconnected() {
                isConnecting = false;
            }
        });
    }

    private void withBillingClient(PluginCall call, Runnable action) {
        createBillingClient();

        if (billingClient != null && billingClient.isReady()) {
            action.run();
            return;
        }

        pendingActions.add(new PendingAction(call, action));
        startConnectionIfNeeded();
    }

    private void flushPendingActions() {
        List<PendingAction> actions = new ArrayList<>(pendingActions);
        pendingActions.clear();

        for (PendingAction pendingAction : actions) {
            pendingAction.action.run();
        }
    }

    private void rejectPendingActions(String message) {
        List<PendingAction> actions = new ArrayList<>(pendingActions);
        pendingActions.clear();

        for (PendingAction pendingAction : actions) {
            pendingAction.call.reject(message);
        }
    }

    private void queryAndLaunchPurchase(
        PluginCall call,
        String productId,
        String preferredOfferToken,
        String productType
    ) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(productType)
                .build()
        );

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(products)
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (!isOk(billingResult)) {
                call.reject(getBillingMessage(billingResult));
                return;
            }

            if (productDetailsList == null || productDetailsList.isEmpty()) {
                call.reject("No se encontro el producto en Google Play");
                return;
            }

            ProductDetails details = productDetailsList.get(0);
            BillingFlowParams.ProductDetailsParams.Builder productDetailsParams =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details);

            if (BillingClient.ProductType.SUBS.equals(productType)) {
                String offerToken = resolveOfferToken(details, preferredOfferToken);
                if (TextUtils.isEmpty(offerToken)) {
                    call.reject("No se encontro una oferta valida para la suscripcion");
                    return;
                }

                productDetailsParams.setOfferToken(offerToken);
            }

            List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList = new ArrayList<>();
            productDetailsParamsList.add(productDetailsParams.build());

            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(productDetailsParamsList)
                .build();

            BillingResult launchResult = billingClient.launchBillingFlow(
                getActivity(),
                flowParams
            );

            if (!isOk(launchResult)) {
                call.reject(getBillingMessage(launchResult));
                return;
            }

            pendingPurchaseCall = call;
        });
    }

    private JSObject serializeProductDetails(ProductDetails details, String productType) {
        JSObject item = new JSObject();
        item.put("productId", details.getProductId());
        item.put("title", details.getTitle());
        item.put("description", details.getDescription());
        item.put("productType", productType);

        if (BillingClient.ProductType.SUBS.equals(productType)) {
            List<ProductDetails.SubscriptionOfferDetails> offers =
                details.getSubscriptionOfferDetails();

            if (offers != null && !offers.isEmpty()) {
                ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
                ProductDetails.PricingPhase pricingPhase =
                    offer.getPricingPhases().getPricingPhaseList().isEmpty()
                        ? null
                        : offer.getPricingPhases().getPricingPhaseList().get(0);

                item.put("offerToken", offer.getOfferToken());
                if (pricingPhase != null) {
                    item.put("formattedPrice", pricingPhase.getFormattedPrice());
                    item.put("priceCurrencyCode", pricingPhase.getPriceCurrencyCode());
                    item.put("billingPeriod", pricingPhase.getBillingPeriod());
                }
            }
        } else {
            ProductDetails.OneTimePurchaseOfferDetails oneTimePurchase =
                details.getOneTimePurchaseOfferDetails();

            if (oneTimePurchase != null) {
                item.put("formattedPrice", oneTimePurchase.getFormattedPrice());
                item.put("priceCurrencyCode", oneTimePurchase.getPriceCurrencyCode());
            }
        }

        return item;
    }

    private JSObject serializePurchase(Purchase purchase) {
        JSObject item = new JSObject();
        item.put("orderId", purchase.getOrderId());
        item.put("packageName", purchase.getPackageName());
        item.put("purchaseToken", purchase.getPurchaseToken());
        item.put("purchaseTime", purchase.getPurchaseTime());
        item.put("purchaseState", mapPurchaseState(purchase.getPurchaseState()));
        item.put("acknowledged", purchase.isAcknowledged());
        item.put("autoRenewing", purchase.isAutoRenewing());
        item.put("signature", purchase.getSignature());
        item.put("originalJson", purchase.getOriginalJson());

        JSArray products = new JSArray();
        List<String> purchaseProducts = purchase.getProducts();
        for (String productId : purchaseProducts) {
            products.put(productId);
        }
        item.put("products", products);

        return item;
    }

    private String resolveOfferToken(ProductDetails details, String preferredOfferToken) {
        List<ProductDetails.SubscriptionOfferDetails> offers =
            details.getSubscriptionOfferDetails();

        if (offers == null || offers.isEmpty()) {
            return null;
        }

        if (!TextUtils.isEmpty(preferredOfferToken)) {
            for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                if (preferredOfferToken.equals(offer.getOfferToken())) {
                    return offer.getOfferToken();
                }
            }
        }

        return offers.get(0).getOfferToken();
    }

    private boolean isOk(BillingResult billingResult) {
        return billingResult != null
            && billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK;
    }

    private String getBillingMessage(BillingResult billingResult) {
        if (billingResult == null) {
            return "Google Play Billing no esta disponible";
        }

        String debugMessage = billingResult.getDebugMessage();
        if (!TextUtils.isEmpty(debugMessage)) {
            return debugMessage;
        }

        return "Google Play Billing devolvio un error";
    }

    private String normalizeProductType(String productType) {
        if ("subs".equalsIgnoreCase(productType)) {
            return BillingClient.ProductType.SUBS;
        }

        return BillingClient.ProductType.INAPP;
    }

    private String mapPurchaseState(int purchaseState) {
        if (purchaseState == Purchase.PurchaseState.PURCHASED) {
            return "purchased";
        }

        if (purchaseState == Purchase.PurchaseState.PENDING) {
            return "pending";
        }

        return "unspecified";
    }
}

/**
 * RevenueCat SDK integration for One More! Pro subscriptions.
 * - Entitlement: "One More! Pro" (identifier: pro)
 * - Products: monthly, yearly, lifetime
 * - Paywall and Customer Center via react-native-purchases-ui
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/** Default API key (test) when env is not set. Use env for production. */
const DEFAULT_API_KEY = 'test_EQpcQoRndAupdfJMJeBHfySuWhD';

/**
 * Entitlement identifier from RevenueCat dashboard (Project → Entitlements).
 * Debe coincidir con el identifier que crees en RevenueCat (display name puede ser "One More! Pro").
 */
export const PRO_ENTITLEMENT_ID = 'pro';

/** Product ID de la suscripción mensual 4,99 €/mes. Usar el mismo en App Store Connect, Play Console y RevenueCat. */
export const MONTHLY_PRODUCT_ID = 'onemore_pro_monthly';

/** Package identifiers para buscar el paquete mensual en el offering (RevenueCat puede usar estos o el product ID). */
export const PACKAGE_IDENTIFIERS = {
  monthly: [MONTHLY_PRODUCT_ID, 'monthly', '$rc_monthly'],
  yearly: ['yearly', 'annual', '$rc_annual'],
  lifetime: ['lifetime', '$rc_lifetime'],
} as const;

function getApiKey(): string | null {
  if (!isNative) return null;
  const ios = Constants.expoConfig?.extra?.revenueCatApiKeyIos ?? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
  const android = Constants.expoConfig?.extra?.revenueCatApiKeyAndroid ?? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;
  const single = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (Platform.OS === 'ios') return ios ?? single ?? DEFAULT_API_KEY;
  if (Platform.OS === 'android') return android ?? single ?? DEFAULT_API_KEY;
  return null;
}

let configured = false;

/**
 * Configure RevenueCat SDK at app startup (setLogLevel + configure with API key).
 * Call once from root layout. Uses same API key for iOS and Android when not set via env.
 */
export async function configureRevenueCat(): Promise<void> {
  if (!isNative) return;
  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const Purchases = (await import('react-native-purchases')).default;
    const { LOG_LEVEL } = await import('react-native-purchases');
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    if (!configured) {
      Purchases.configure({ apiKey });
      configured = true;
    }
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat configure:', e);
  }
}

/**
 * Identify the user in RevenueCat (Supabase auth uid). Call after configureRevenueCat when user is ready.
 */
export async function initRevenueCat(supabaseUserId: string): Promise<void> {
  if (!isNative) return;
  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const Purchases = (await import('react-native-purchases')).default;
    if (!configured) {
      await configureRevenueCat();
    }
    await Purchases.logIn(supabaseUserId);
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat init:', e);
  }
}

/**
 * Get current customer info from RevenueCat.
 */
export async function getCustomerInfo(): Promise<{ customerInfo: import('@revenuecat/purchases-typescript-internal').CustomerInfo } | { error: string }> {
  if (!isNative) return { error: 'Only available on iOS/Android' };
  const apiKey = getApiKey();
  if (!apiKey) return { error: 'RevenueCat not configured' };

  try {
    const Purchases = (await import('react-native-purchases')).default;
    const customerInfo = await Purchases.getCustomerInfo();
    return { customerInfo };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}

/**
 * Check if the user has the "One More! Pro" entitlement.
 */
export async function hasProEntitlement(): Promise<boolean> {
  const result = await getCustomerInfo();
  if ('error' in result) return false;
  return typeof result.customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
}

/**
 * Get current offerings (products: monthly, yearly, lifetime).
 */
export async function getOfferings(): Promise<{ offerings: unknown } | { error: string }> {
  if (!isNative) return { error: 'Only available on iOS/Android' };
  const apiKey = getApiKey();
  if (!apiKey) return { error: 'RevenueCat not configured' };

  try {
    const Purchases = (await import('react-native-purchases')).default;
    const offerings = await Purchases.getOfferings();
    return { offerings };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}

/** Sync Pro status to our backend after a successful purchase/restore. */
async function syncProToBackend(): Promise<void> {
  try {
    await supabase.functions.invoke('confirm-iap-pro');
  } catch (e) {
    if (__DEV__) console.warn('confirm-iap-pro failed:', e);
  }
}

/**
 * Present the RevenueCat Paywall (current offering with monthly, yearly, lifetime).
 * On PURCHASED or RESTORED, syncs to backend and returns true.
 */
export async function presentPaywall(): Promise<{
  success: boolean;
  result?: string;
  error?: string;
}> {
  if (!isNative) {
    return { success: false, error: 'Only available on iOS/Android' };
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'RevenueCat not configured' };
  }

  try {
    const RevenueCatUI = (await import('react-native-purchases-ui')).default;
    const { PAYWALL_RESULT } = await import('react-native-purchases-ui');
    const result = await RevenueCatUI.presentPaywall({ displayCloseButton: true });

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        await syncProToBackend();
        return { success: true, result };
      case PAYWALL_RESULT.CANCELLED:
        return { success: false, result: 'cancelled' };
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      default:
        return { success: false, result: result ?? 'error' };
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) };
  }
}

/**
 * Present the Paywall only if the user does not have the Pro entitlement.
 */
export async function presentPaywallIfNeeded(): Promise<{
  presented: boolean;
  success?: boolean;
  error?: string;
}> {
  if (!isNative) return { presented: false, error: 'Only available on iOS/Android' };
  const apiKey = getApiKey();
  if (!apiKey) return { presented: false, error: 'RevenueCat not configured' };

  try {
    const RevenueCatUI = (await import('react-native-purchases-ui')).default;
    const { PAYWALL_RESULT } = await import('react-native-purchases-ui');
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
      displayCloseButton: true,
    });

    const presented = result !== PAYWALL_RESULT.NOT_PRESENTED;
    const success = result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    if (success) await syncProToBackend();
    return { presented, success };
  } catch (e: any) {
    return { presented: false, error: e?.message ?? String(e) };
  }
}

/**
 * Present the Customer Center (manage subscription, restore, support).
 */
export async function presentCustomerCenter(): Promise<{ error?: string }> {
  if (!isNative) return { error: 'Only available on iOS/Android' };
  const apiKey = getApiKey();
  if (!apiKey) return { error: 'RevenueCat not configured' };

  try {
    const RevenueCatUI = (await import('react-native-purchases-ui')).default;
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: async () => {
          await syncProToBackend();
        },
      },
    });
    return {};
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}

/**
 * Programmatic purchase (fallback if you don't use the Paywall UI).
 * Prefer presentPaywall() for best UX.
 */
export async function purchasePro(): Promise<{ success: boolean; error?: string }> {
  if (!isNative) return { success: false, error: 'Only available on iOS/Android' };
  const apiKey = getApiKey();
  if (!apiKey) return { success: false, error: 'RevenueCat not configured' };

  try {
    const Purchases = (await import('react-native-purchases')).default;
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current;
    if (!offering || !offering.availablePackages?.length) {
      return { success: false, error: 'No hay planes disponibles. Intenta más tarde.' };
    }

    const pkg =
      offering.availablePackages.find((p) =>
        PACKAGE_IDENTIFIERS.monthly.some((id) => p.identifier === id || p.packageType === 'MONTHLY')
      ) ?? offering.availablePackages[0];

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
    if (isPro) {
      await syncProToBackend();
      return { success: true };
    }
    return { success: false, error: 'Compra no activada. Restaura compras o contacta soporte.' };
  } catch (e: any) {
    if (e?.userCancelled) return { success: false, error: 'Cancelado' };
    return { success: false, error: e?.message ?? String(e) };
  }
}

/**
 * Restore previous purchases.
 */
export async function restorePurchases(): Promise<{ success: boolean; isPro: boolean; error?: string }> {
  if (!isNative) return { success: false, isPro: false, error: 'Only available on iOS/Android' };
  const apiKey = getApiKey();
  if (!apiKey) return { success: false, isPro: false, error: 'RevenueCat not configured' };

  try {
    const Purchases = (await import('react-native-purchases')).default;
    const customerInfo = await Purchases.restorePurchases();
    const isPro = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
    if (isPro) await syncProToBackend();
    return { success: true, isPro };
  } catch (e: any) {
    return { success: false, isPro: false, error: e?.message ?? String(e) };
  }
}

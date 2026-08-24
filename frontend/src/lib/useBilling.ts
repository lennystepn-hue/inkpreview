import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { fetchBillingConfig, openBillingPortal } from "./api";

/** Whether Stripe billing is live — cached; drives whether upgrade UI shows. */
export function useBillingConfig() {
  return useQuery({
    queryKey: ["billing-config"],
    queryFn: fetchBillingConfig,
    staleTime: 5 * 60_000,
  });
}

/** Redirect to the Stripe Customer Portal (manage/cancel). `busy` guards double-clicks.
 *  Checkout itself is handled by the UpgradeModal (it must collect the withdrawal waiver). */
export function useBillingActions() {
  const [busy, setBusy] = useState(false);
  const manage = async () => {
    setBusy(true);
    try {
      const { url } = await openBillingPortal();
      window.location.href = url;
    } catch {
      setBusy(false);
    }
  };
  return { busy, manage };
}

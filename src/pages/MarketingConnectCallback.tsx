import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { AdsProvider, PROVIDER_LABEL } from "@/lib/ads-mapper";
import { useCompleteAdsConnect } from "@/hooks/api/use-ads";

/**
 * OAuth landing page for the Marketing ads connect flow. One component serves
 * both providers via the `:provider` route segment
 * (`/marketing/connect/google/callback` + `/marketing/connect/meta/callback`).
 *
 * Google / Meta redirect the browser here with `?code&state`. We validate
 * `state` against the value the Connect button stashed in sessionStorage, then
 * POST the code to the backend to exchange it for tokens, and bounce back to
 * /marketing. Mirrors FacebookConnectCallback (lives inside the protected
 * layout so the authed callback carries the admin's token).
 */
export default function MarketingConnectCallback() {
  const { provider: providerParam } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const completeConnect = useCompleteAdsConnect();
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const provider = (providerParam === "google" || providerParam === "meta"
    ? providerParam
    : null) as AdsProvider | null;

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const run = async () => {
      if (!provider) {
        setError("Unknown ad provider in the callback URL.");
        return;
      }

      const oauthError = params.get("error_description") || params.get("error");
      if (oauthError) {
        setError(`${PROVIDER_LABEL[provider]} returned: ${oauthError}`);
        return;
      }

      const code = params.get("code") ?? undefined;
      const state = params.get("state") ?? undefined;
      const expectedState = sessionStorage.getItem("ads_connect_state");
      sessionStorage.removeItem("ads_connect_state");

      if (!code) {
        setError(`No authorization code was returned by ${PROVIDER_LABEL[provider]}.`);
        return;
      }
      if (expectedState && state && expectedState !== state) {
        setError(
          "State mismatch — this connection wasn't initiated from this device. Please try again.",
        );
        return;
      }

      try {
        await completeConnect.mutateAsync({ provider, code, state });
        toast.success(`${PROVIDER_LABEL[provider]} connected`);
        navigate("/marketing", { replace: true });
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : `Could not complete the ${PROVIDER_LABEL[provider]} connection.`,
        );
      }
    };

    void run();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-in flex items-center justify-center py-24">
      <div className="stat-card max-w-md w-full text-center">
        {error ? (
          <>
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-600" />
            <h1 className="text-lg font-semibold mb-1">Couldn't connect</h1>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              className="text-sm text-primary underline"
              onClick={() => navigate("/marketing", { replace: true })}
            >
              Back to Marketing
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-muted-foreground" />
            <h1 className="text-lg font-semibold mb-1">
              Connecting your {provider ? PROVIDER_LABEL[provider] : "ad"} account…
            </h1>
            <p className="text-sm text-muted-foreground">Exchanging the authorization code.</p>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useCompleteConnect } from "@/hooks/api/use-facebook";

/**
 * OAuth landing page for Facebook connect (Phase 0b).
 *
 * Facebook redirects the browser here (FACEBOOK_REDIRECT_URI) with `?code&state`
 * — or `?error` if the user declined. We validate `state` against the value the
 * Connect button stashed in sessionStorage, then POST the code to the backend
 * to exchange it for Page tokens, and bounce back to /facebook.
 *
 * Lives INSIDE the protected layout: the admin's SPA session is still active in
 * the same browser, so the authed `/facebook/connect/callback` call carries
 * their token (the connect endpoint is gated Facebook Listings:edit).
 */
export default function FacebookConnectCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const completeConnect = useCompleteConnect();
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard against React 18 StrictMode's double effect invoke (would double-POST).
    if (ranRef.current) return;
    ranRef.current = true;

    const run = async () => {
      const fbError = params.get("error_description") || params.get("error");
      if (fbError) {
        setError(`Facebook returned: ${fbError}`);
        return;
      }

      const code = params.get("code") ?? undefined;
      const state = params.get("state") ?? undefined;
      const expectedState = sessionStorage.getItem("fb_connect_state");
      sessionStorage.removeItem("fb_connect_state");

      if (!code) {
        setError("No authorization code was returned by Facebook.");
        return;
      }
      if (expectedState && state && expectedState !== state) {
        setError(
          "State mismatch — this connection wasn't initiated from this device. Please try again.",
        );
        return;
      }

      try {
        await completeConnect.mutateAsync({ code, state });
        toast.success("Facebook account connected");
        navigate("/facebook", { replace: true });
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Could not complete the Facebook connection.",
        );
      }
    };

    void run();
    // Run once on mount; params/navigate/mutation are stable for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-in flex items-center justify-center py-24">
      <div className="stat-card max-w-md w-full text-center">
        {error ? (
          <>
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-600" />
            <h1 className="text-lg font-semibold mb-1">Couldn't connect Facebook</h1>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              className="text-sm text-primary underline"
              onClick={() => navigate("/facebook", { replace: true })}
            >
              Back to Facebook Listings
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-muted-foreground" />
            <h1 className="text-lg font-semibold mb-1">Connecting your Facebook account…</h1>
            <p className="text-sm text-muted-foreground">
              Exchanging the authorization code with Facebook.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

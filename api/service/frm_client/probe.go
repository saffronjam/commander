package frm_client

import (
	"api/models/models"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const probeTimeout = 10 * time.Second

// ProbeError reports why a probe failed, using the same two failure shapes the
// poller reports for a live session. Reason is what a client renders; Cause
// carries the technical detail for logs.
type ProbeError struct {
	Reason models.ConnectivityReason
	Cause  error
}

func (e *ProbeError) Error() string {
	if e.Cause == nil {
		return fmt.Sprintf("probe failed: %s", e.Reason)
	}
	return e.Cause.Error()
}

func (e *ProbeError) Unwrap() error { return e.Cause }

func probeFailed(reason models.ConnectivityReason, format string, args ...any) *ProbeError {
	return &ProbeError{Reason: reason, Cause: fmt.Errorf(format, args...)}
}

// ProbeSessionInfo reads one server's session info without building a Client.
// A Client starts a request-queue goroutine it never stops on its own, and a
// probe needs none of the polling machinery it exists to serialize.
func ProbeSessionInfo(ctx context.Context, address string) (*models.SessionInfo, error) {
	apiURL := address
	if !strings.HasPrefix(apiURL, "http://") && !strings.HasPrefix(apiURL, "https://") {
		apiURL = "http://" + apiURL
	}
	endpoint, err := url.JoinPath(apiURL, "/getSessionInfo")
	if err != nil {
		return nil, probeFailed(models.ConnectivityReasonNoResponse, "invalid address %q: %w", address, err)
	}

	reqCtx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, probeFailed(models.ConnectivityReasonNoResponse, "invalid address %q: %w", address, err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, &ProbeError{Reason: classifyRequestError(err), Cause: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, probeFailed(models.ConnectivityReasonBadResponse, "%s answered %s", address, resp.Status)
	}

	var raw models.SessionInfoRaw
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, probeFailed(models.ConnectivityReasonBadResponse, "%s did not answer as FRM: %w", address, err)
	}
	if raw.SessionName == "" {
		return nil, probeFailed(models.ConnectivityReasonBadResponse, "%s reported no save name", address)
	}
	return raw.ToDTO(), nil
}

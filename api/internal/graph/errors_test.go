package graph

import (
	"errors"
	"testing"

	"github.com/vektah/gqlparser/v2/gqlerror"

	"api/models/models"
	"api/service/frm_client"
)

// The client renders wording from the reason, so the reason has to survive the
// trip through the GraphQL error. Without it the UI falls back to showing the Go
// error string.
func TestProbeErrorCarriesReason(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantReason string
	}{
		{
			name:       "nothing answered",
			err:        &frm_client.ProbeError{Reason: models.ConnectivityReasonNoResponse},
			wantReason: "NO_RESPONSE",
		},
		{
			name:       "answered but not FRM",
			err:        &frm_client.ProbeError{Reason: models.ConnectivityReasonBadResponse},
			wantReason: "BAD_RESPONSE",
		},
		{
			name:       "an error the probe did not classify",
			err:        errors.New("boom"),
			wantReason: "NO_RESPONSE",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gqlErr := asGqlError(t, probeError("10.10.10.10", tt.err))

			if got := gqlErr.Extensions["code"]; got != "FRM_UNREACHABLE" {
				t.Fatalf("want code FRM_UNREACHABLE, got %v", got)
			}
			if got := gqlErr.Extensions["reason"]; got != tt.wantReason {
				t.Fatalf("want reason %s, got %v", tt.wantReason, got)
			}
			if gqlErr.Message != "could not reach FRM at 10.10.10.10" {
				t.Fatalf("want a message with no Go plumbing in it, got %q", gqlErr.Message)
			}
		})
	}
}

// The technical cause stays available for the console without being rendered.
func TestProbeErrorKeepsDetail(t *testing.T) {
	cause := errors.New(`Get "http://10.10.10.10/getSessionInfo": context deadline exceeded`)
	gqlErr := asGqlError(t, probeError("10.10.10.10", cause))

	if got := gqlErr.Extensions["detail"]; got != cause.Error() {
		t.Fatalf("want the cause preserved in detail, got %v", got)
	}
}

func asGqlError(t *testing.T, err error) *gqlerror.Error {
	t.Helper()
	var gqlErr *gqlerror.Error
	if !errors.As(err, &gqlErr) {
		t.Fatalf("want a *gqlerror.Error so extensions reach the client, got %T", err)
	}
	return gqlErr
}

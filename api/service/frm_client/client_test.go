package frm_client

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net"
	"net/url"
	"testing"

	"api/models/models"
)

// The whole point of the split is that a timeout and a TLS failure mean different
// things to the operator, so the classifier is asserted directly.
func TestClassifyRequestError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want models.ConnectivityReason
	}{
		{
			name: "timeout means nothing answered",
			err:  &url.Error{Op: "Get", Err: context.DeadlineExceeded},
			want: models.ConnectivityReasonNoResponse,
		},
		{
			name: "connection refused means nothing is listening",
			err:  &url.Error{Op: "Get", Err: &net.OpError{Op: "dial", Err: errors.New("connection refused")}},
			want: models.ConnectivityReasonNoResponse,
		},
		{
			name: "unknown authority means something answered, but not FRM",
			err:  &url.Error{Op: "Get", Err: x509.UnknownAuthorityError{}},
			want: models.ConnectivityReasonBadResponse,
		},
		{
			name: "certificate verification failure is a proxy or https in front",
			err:  &url.Error{Op: "Get", Err: &tls.CertificateVerificationError{}},
			want: models.ConnectivityReasonBadResponse,
		},
		{
			name: "plaintext http against a tls port",
			err:  &url.Error{Op: "Get", Err: tls.RecordHeaderError{Msg: "first record does not look like a TLS handshake"}},
			want: models.ConnectivityReasonBadResponse,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyRequestError(tc.err); got != tc.want {
				t.Fatalf("want %q, got %q", tc.want, got)
			}
		})
	}
}

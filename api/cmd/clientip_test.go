package cmd

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIPResolvesToABareIP(t *testing.T) {
	tests := []struct {
		name       string
		remoteAddr string
		headers    map[string]string
		want       string
	}{
		{
			name:       "remote address carries an ephemeral port",
			remoteAddr: "192.168.1.42:54321",
			want:       "192.168.1.42",
		},
		{
			name:       "a forwarded chain names the client first",
			remoteAddr: "10.42.0.1:80",
			headers:    map[string]string{"X-Forwarded-For": "192.168.1.42, 10.0.0.1, 172.17.0.1"},
			want:       "192.168.1.42",
		},
		{
			name:       "a single forwarded value",
			remoteAddr: "10.42.0.1:80",
			headers:    map[string]string{"X-Forwarded-For": "192.168.1.42"},
			want:       "192.168.1.42",
		},
		{
			name:       "real ip is used when there is no forwarded chain",
			remoteAddr: "10.42.0.1:80",
			headers:    map[string]string{"X-Real-IP": "192.168.1.42"},
			want:       "192.168.1.42",
		},
		{
			name:       "forwarded wins over real ip",
			remoteAddr: "10.42.0.1:80",
			headers:    map[string]string{"X-Forwarded-For": "192.168.1.42", "X-Real-IP": "192.168.1.99"},
			want:       "192.168.1.42",
		},
		{
			name:       "a bracketed ipv6 remote address",
			remoteAddr: "[fd00::1]:54321",
			want:       "fd00::1",
		},
		{
			name:       "an ipv4-mapped ipv6 address is reported as ipv4",
			remoteAddr: "[::ffff:192.168.1.42]:54321",
			want:       "192.168.1.42",
		},
		{
			name:       "a garbage forwarded header falls through",
			remoteAddr: "192.168.1.42:54321",
			headers:    map[string]string{"X-Forwarded-For": "not-an-ip"},
			want:       "192.168.1.42",
		},
		{
			name:       "nothing usable yields nothing",
			remoteAddr: "unix",
			want:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/graphql", nil)
			req.RemoteAddr = tt.remoteAddr
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}
			if got := clientIP(req); got != tt.want {
				t.Fatalf("want %q, got %q", tt.want, got)
			}
		})
	}
}

// The rate limiter buckets on whatever clientIP returns. If the ephemeral source
// port survived, every new connection would get a fresh bucket with a full burst
// and the login limiter would never limit anything.
func TestClientIPIgnoresTheSourcePort(t *testing.T) {
	first := httptest.NewRequest(http.MethodPost, "/graphql", nil)
	first.RemoteAddr = "192.168.1.42:54321"

	second := httptest.NewRequest(http.MethodPost, "/graphql", nil)
	second.RemoteAddr = "192.168.1.42:61000"

	a, b := clientIP(first), clientIP(second)
	if a != b {
		t.Fatalf("two connections from one host must share a rate limiter bucket, got %q and %q", a, b)
	}
}

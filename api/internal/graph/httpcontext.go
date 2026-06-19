package graph

import (
	"context"
	"net/http"
	"time"
)

// authCookieName is the same-origin HTTP-only cookie carrying the access token.
const authCookieName = "sd_access_token"

type rwCtxKey struct{}
type clientIPCtxKey struct{}

// WithResponseWriter attaches the HTTP response writer so mutations can set cookies.
func WithResponseWriter(ctx context.Context, w http.ResponseWriter) context.Context {
	return context.WithValue(ctx, rwCtxKey{}, w)
}

func responseWriterFromContext(ctx context.Context) (http.ResponseWriter, bool) {
	w, ok := ctx.Value(rwCtxKey{}).(http.ResponseWriter)
	return w, ok
}

// WithClientIP attaches the resolved client IP for rate-limiting / clientIp.
func WithClientIP(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, clientIPCtxKey{}, ip)
}

// ClientIPFromContext returns the resolved client IP, or "".
func ClientIPFromContext(ctx context.Context) string {
	ip, _ := ctx.Value(clientIPCtxKey{}).(string)
	return ip
}

func setAuthCookie(ctx context.Context, token string, ttl time.Duration) {
	w, ok := responseWriterFromContext(ctx)
	if !ok {
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   int(ttl.Seconds()),
		SameSite: http.SameSiteLaxMode,
	})
}

func clearAuthCookie(ctx context.Context) {
	w, ok := responseWriterFromContext(ctx)
	if !ok {
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		SameSite: http.SameSiteLaxMode,
	})
}

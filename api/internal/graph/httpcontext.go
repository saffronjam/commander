package graph

import (
	"context"
	"net/http"
	"strings"
	"time"

	"api/pkg/config"
)

// AuthCookieName is the same-origin HTTP-only cookie carrying the access token.
const AuthCookieName = "sd_access_token"

// secureCookies reports whether the instance is served over HTTPS, in which case
// the auth cookie must not be sent over plaintext.
func secureCookies() bool {
	return strings.HasPrefix(config.Config.ExternalURL, "https://")
}

type rwCtxKey struct{}
type clientIPCtxKey struct{}
type accessTokenCtxKey struct{}

// WithAccessToken attaches the raw access token from the request cookie so
// logout can revoke it server-side rather than only clearing the cookie.
func WithAccessToken(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, accessTokenCtxKey{}, token)
}

func accessTokenFromContext(ctx context.Context) string {
	token, _ := ctx.Value(accessTokenCtxKey{}).(string)
	return token
}

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
		Name:     AuthCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookies(),
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
		Name:     AuthCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookies(),
		MaxAge:   -1,
		SameSite: http.SameSiteLaxMode,
	})
}

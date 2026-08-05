package auth

import "testing"

// The limiter is the only thing standing between an exposed login form and
// offline-speed guessing, so its burst behaviour is asserted directly.
func TestRateLimiterAllowsBurstThenDenies(t *testing.T) {
	rl := NewRateLimiter()
	t.Cleanup(rl.Stop)

	for i := 0; i < requestsPerMinute; i++ {
		if !rl.Allow("1.2.3.4") {
			t.Fatalf("request %d of the burst must be allowed", i+1)
		}
	}
	if rl.Allow("1.2.3.4") {
		t.Fatal("want the request after the burst denied")
	}
}

func TestRateLimiterIsPerIP(t *testing.T) {
	rl := NewRateLimiter()
	t.Cleanup(rl.Stop)

	for i := 0; i < requestsPerMinute; i++ {
		rl.Allow("1.2.3.4")
	}
	if !rl.Allow("5.6.7.8") {
		t.Fatal("one client exhausting its budget must not block another")
	}
}

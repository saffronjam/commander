package store_test

import (
	"testing"
	"time"

	"api/internal/auth"
	"api/internal/store"
)

func TestUpsertHistoryPointOverwrites(t *testing.T) {
	st, ctx := newStore(t)
	seedSession(t, st, ctx)
	if err := st.UpsertHistoryPoint(ctx, testSession, "circuits", 100, []byte(`{"v":1}`)); err != nil {
		t.Fatal(err)
	}
	if err := st.UpsertHistoryPoint(ctx, testSession, "circuits", 100, []byte(`{"v":2}`)); err != nil {
		t.Fatal(err)
	}
	pts, err := st.QueryHistory(ctx, store.HistoryQuery{SessionID: testSession, DataType: "circuits", Since: -1})
	if err != nil {
		t.Fatal(err)
	}
	if len(pts) != 1 {
		t.Fatalf("want 1 point after same-game-time overwrite, got %d", len(pts))
	}
	if string(pts[0].Data) != `{"v":2}` {
		t.Fatalf("want overwritten data {\"v\":2}, got %s", pts[0].Data)
	}
}

func TestQueryHistoryRawSince(t *testing.T) {
	st, ctx := newStore(t)
	seedSession(t, st, ctx)
	for i := int64(1); i <= 10; i++ {
		if err := st.UpsertHistoryPoint(ctx, testSession, "circuits", i, []byte(`{}`)); err != nil {
			t.Fatal(err)
		}
	}
	pts, err := st.QueryHistory(ctx, store.HistoryQuery{SessionID: testSession, DataType: "circuits", Since: 5})
	if err != nil {
		t.Fatal(err)
	}
	if len(pts) != 5 || pts[0].GameTimeID != 6 || pts[4].GameTimeID != 10 {
		t.Fatalf("since=5 want ids 6..10, got %+v", pts)
	}
}

func TestQueryHistoryLimitKeepsNewest(t *testing.T) {
	st, ctx := newStore(t)
	seedSession(t, st, ctx)
	for i := int64(1); i <= 10; i++ {
		if err := st.UpsertHistoryPoint(ctx, testSession, "circuits", i, []byte(`{}`)); err != nil {
			t.Fatal(err)
		}
	}
	raw, err := st.QueryHistory(ctx, store.HistoryQuery{SessionID: testSession, DataType: "circuits", Since: -1, Limit: 3})
	if err != nil {
		t.Fatal(err)
	}
	assertIDs(t, "raw limit=3", raw, []int64{8, 9, 10})

	bucketed, err := st.QueryHistory(ctx, store.HistoryQuery{SessionID: testSession, DataType: "circuits", Since: -1, BucketSeconds: 2, Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	assertIDs(t, "bucketed limit=2", bucketed, []int64{9, 10})
}

func TestQueryHistoryBucketedKeepsLast(t *testing.T) {
	st, ctx := newStore(t)
	seedSession(t, st, ctx)
	for i := int64(1); i <= 9; i++ {
		if err := st.UpsertHistoryPoint(ctx, testSession, "circuits", i, []byte(`{}`)); err != nil {
			t.Fatal(err)
		}
	}
	pts, err := st.QueryHistory(ctx, store.HistoryQuery{SessionID: testSession, DataType: "circuits", Since: -1, BucketSeconds: 3})
	if err != nil {
		t.Fatal(err)
	}
	assertIDs(t, "bucketed keep-last", pts, []int64{2, 5, 8, 9})
}

func TestPruneHistoryOlderThan(t *testing.T) {
	st, ctx := newStore(t)
	seedSession(t, st, ctx)
	for i := int64(1); i <= 10; i++ {
		_ = st.UpsertHistoryPoint(ctx, testSession, "circuits", i, []byte(`{}`))
	}
	n, err := st.PruneHistoryOlderThan(ctx, testSession, "circuits", 5)
	if err != nil {
		t.Fatal(err)
	}
	if n != 4 {
		t.Fatalf("want 4 rows pruned (ids 1..4), got %d", n)
	}
	pts, _ := st.QueryHistory(ctx, store.HistoryQuery{SessionID: testSession, DataType: "circuits", Since: -1})
	if len(pts) != 6 || pts[0].GameTimeID != 5 {
		t.Fatalf("after prune want ids 5..10, got %+v", pts)
	}
}

func TestHistoryCascadeOnSessionDelete(t *testing.T) {
	st, ctx := newStore(t)
	seedSession(t, st, ctx)
	if err := st.UpsertHistoryPoint(ctx, testSession, "circuits", 1, []byte(`{}`)); err != nil {
		t.Fatal(err)
	}
	if err := st.DeleteSession(ctx, testSession); err != nil {
		t.Fatal(err)
	}
	pts, err := st.QueryHistory(ctx, store.HistoryQuery{SessionID: testSession, DataType: "circuits", Since: -1})
	if err != nil {
		t.Fatal(err)
	}
	if len(pts) != 0 {
		t.Fatalf("want history cascaded away on session delete, got %d points", len(pts))
	}
}

func TestTokenExpiryAndPrune(t *testing.T) {
	st, ctx := newStore(t)
	now := time.Now()
	if err := st.InsertToken(ctx, auth.Token("expired").Hash(), now.Add(-time.Hour), "1.2.3.4"); err != nil {
		t.Fatal(err)
	}
	if err := st.InsertToken(ctx, auth.Token("valid").Hash(), now.Add(time.Hour), "1.2.3.4"); err != nil {
		t.Fatal(err)
	}
	if _, err := st.GetValidToken(ctx, auth.Token("expired").Hash(), now); err != store.ErrNotFound {
		t.Fatalf("expired token must not validate, got err=%v", err)
	}
	got, err := st.GetValidToken(ctx, auth.Token("valid").Hash(), now)
	if err != nil {
		t.Fatalf("valid token must validate, got err=%v", err)
	}
	if got.ClientIP != "1.2.3.4" {
		t.Fatalf("want client ip round-tripped, got %q", got.ClientIP)
	}
	n, err := st.RunTokenPrune(ctx, now)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("want 1 expired token pruned, got %d", n)
	}
}

func assertIDs(t *testing.T, label string, pts []store.HistoryPoint, want []int64) {
	t.Helper()
	got := make([]int64, len(pts))
	for i, p := range pts {
		got[i] = p.GameTimeID
	}
	if len(got) != len(want) {
		t.Fatalf("%s want %v, got %v", label, want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("%s want %v, got %v", label, want, got)
		}
	}
}

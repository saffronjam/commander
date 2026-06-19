package store

import "api/internal/store/sqlite"

func boolToInt64(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

func int64ToBool(i int64) bool { return i != 0 }

func rawToHistoryPoints(rows []sqlite.QueryHistoryRawRow) []HistoryPoint {
	out := make([]HistoryPoint, len(rows))
	for i, r := range rows {
		out[i] = HistoryPoint{GameTimeID: r.GameTimeID, Data: []byte(r.Data)}
	}
	return out
}

func bucketedToHistoryPoints(rows []sqlite.QueryHistoryBucketedRow) []HistoryPoint {
	out := make([]HistoryPoint, len(rows))
	for i, r := range rows {
		out[i] = HistoryPoint{GameTimeID: r.GameTimeID, Data: []byte(r.Data)}
	}
	return out
}

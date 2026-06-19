package models

// DataPoint represents a single measurement at a point in game time.
// Used for storing historical data points in the SQLite history table.
type DataPoint struct {
	GameTimeID int64  `json:"gameTimeId"` // Game time in seconds when data was captured
	DataType   string `json:"dataType"`   // One of: circuits, generatorStats, prodStats, factoryStats, sinkStats
	Data       any    `json:"data"`       // The actual data payload (type depends on DataType)
}

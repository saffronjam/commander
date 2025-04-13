package models

type SinkStats struct {
	TotalPoints        float64 `json:"totalPoints"`
	Coupons            int     `json:"coupons"`
	NextCouponProgress float64 `json:"nextCouponProgress"`
	PointsPerMinute    float64 `json:"pointsPerMinute"`
}

func (sinkStats *SinkStats) ToDTO() SinkStatsDTO {
	return *sinkStats
}

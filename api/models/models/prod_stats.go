package models

type ItemProdStats struct {
	ItemStats `json:",inline" tstype:",extends"`

	ProducedPerMinute   float64 `json:"producedPerMinute"`
	MaxProducePerMinute float64 `json:"maxProducePerMinute"`
	ProduceEfficiency   float64 `json:"produceEfficiency"`

	ConsumedPerMinute   float64 `json:"consumedPerMinute"`
	MaxConsumePerMinute float64 `json:"maxConsumePerMinute"`
	ConsumeEfficiency   float64 `json:"consumeEfficiency"`

	Minable bool `json:"minable"`
}

type ProdStats struct {
	MinableProducedPerMinute float64         `json:"minableProducedPerMinute"`
	MinableConsumedPerMinute float64         `json:"minableConsumedPerMinute"`
	ItemsProducedPerMinute   float64         `json:"itemsProducedPerMinute"`
	ItemsConsumedPerMinute   float64         `json:"itemsConsumedPerMinute"`
	Items                    []ItemProdStats `json:"items"`
}

func (prodStats *ProdStats) ToDTO() ProdStatsDTO {
	return *prodStats
}

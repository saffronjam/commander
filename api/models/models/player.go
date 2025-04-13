package models

type Player struct {
	ID     string      `json:"id"`
	Name   string      `json:"name"`
	Health float64     `json:"health"`
	Items  []ItemStats `json:"items"`
}

func (player *Player) ToDTO() PlayerDTO {
	return *player
}

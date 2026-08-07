package frmmock

import (
	"api/models/models"
	"api/service/frm_client/frm_models"
	"math"
)

// renderResourceNodes reports every node in the world. Name must match a scraped
// icon filename or the map renders the node without an icon, so the names come
// from the resource catalog rather than being composed here.
func renderResourceNodes(w *World) []frm_models.ResourceNode {
	out := make([]frm_models.ResourceNode, 0, len(w.Nodes))
	for _, n := range w.Nodes {
		out = append(out, frm_models.ResourceNode{
			ID:           n.ID,
			Name:         n.Resource.Name,
			ClassName:    n.Resource.Class,
			Purity:       n.Purity,
			EnumPurity:   n.Purity,
			ResourceForm: n.Resource.Form,
			NodeType:     string(models.NodeTypeNode),
			Exploited:    n.Exploited,
			Location:     location(n.Loc, 0),
		})
	}
	return out
}

// playerWalkPeriodSeconds is how long a pioneer takes to walk their loop. Players
// move so the map is not static even before vehicles exist.
const playerWalkPeriodSeconds = 180

// renderPlayers reports the pioneers. A player with an empty name is dropped by the
// client, and players are one of the events a session needs to become ready.
func renderPlayers(w *World, t float64) []frm_models.Player {
	out := make([]frm_models.Player, 0, len(w.Players))
	for i, p := range w.Players {
		phase := float64(i) / math.Max(1, float64(len(w.Players)))
		angle := 2 * math.Pi * (t/playerWalkPeriodSeconds + phase)
		const radius = 2500
		loc := clampToWorld(Point{
			X: p.Loc.X + math.Cos(angle)*radius,
			Y: p.Loc.Y + math.Sin(angle)*radius,
			Z: p.Loc.Z,
		})

		inventory := make([]frm_models.ItemAmount, 0, len(p.Inventory))
		for _, item := range p.Inventory {
			inventory = append(inventory, frm_models.ItemAmount{Name: item.Name, Amount: item.Amount})
		}

		out = append(out, frm_models.Player{
			Id:        p.ID,
			Name:      p.Name,
			PlayerHP:  p.HP,
			Location:  location(loc, quantise(math.Mod(angle*180/math.Pi, 360), 1)),
			Inventory: inventory,
		})
	}
	return out
}

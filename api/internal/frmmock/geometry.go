package frmmock

import (
	"api/service/frm_client/frm_models"
	"math"
)

// World bounds in centimetres, taken from the dashboard's map projection. Every
// generated coordinate must fall inside these, or it renders outside the tiles.
const (
	WorldMinX = -324698.832031
	WorldMaxX = 425301.832031
	WorldMinY = -375000.0
	WorldMaxY = 375000.0
	WorldMinZ = -2000.0
	WorldMaxZ = 25000.0
)

// Point is a world position in centimetres.
type Point struct {
	X, Y, Z float64
}

// Rect is an axis-aligned region of the world in centimetres.
type Rect struct {
	MinX, MinY, MaxX, MaxY float64
}

// center reports the middle of the rect at the given elevation.
func (r Rect) center(z float64) Point {
	return Point{X: (r.MinX + r.MaxX) / 2, Y: (r.MinY + r.MaxY) / 2, Z: z}
}

// contains reports whether p is inside the rect, ignoring elevation.
func (r Rect) contains(p Point) bool {
	return p.X >= r.MinX && p.X <= r.MaxX && p.Y >= r.MinY && p.Y <= r.MaxY
}

// location renders a point plus a rotation as the FRM wire shape.
func location(p Point, rotation float64) frm_models.Location {
	return frm_models.Location{
		X:        quantise(p.X, 3),
		Y:        quantise(p.Y, 3),
		Z:        quantise(p.Z, 3),
		Rotation: quantise(rotation, 2),
	}
}

// boxAround builds the footprint the map draws for a building. A zero box makes
// the building invisible, so every placed building needs one.
func boxAround(p Point, width, depth, height float64) frm_models.BoundingBox {
	return frm_models.BoundingBox{
		Min: location(Point{X: p.X - width/2, Y: p.Y - depth/2, Z: p.Z}, 0),
		Max: location(Point{X: p.X + width/2, Y: p.Y + depth/2, Z: p.Z + height}, 0),
	}
}

// dist2D reports the horizontal distance between two points in centimetres.
func dist2D(a, b Point) float64 {
	dx, dy := a.X-b.X, a.Y-b.Y
	return math.Sqrt(dx*dx + dy*dy)
}

// clampToWorld pulls a point inside the world bounds, keeping a margin so a
// building's footprint cannot straddle the edge.
func clampToWorld(p Point) Point {
	const margin = 4000
	p.X = math.Min(math.Max(p.X, WorldMinX+margin), WorldMaxX-margin)
	p.Y = math.Min(math.Max(p.Y, WorldMinY+margin), WorldMaxY-margin)
	p.Z = math.Min(math.Max(p.Z, WorldMinZ), WorldMaxZ)
	return p
}

package frmmock

import "api/service/frm_client/frm_models"

// splineOf is the polyline FRM reports for a conveyor. Both ends are taken from
// the conveyor's resolved endpoints, so a rendered belt always terminates on the
// buildings it was generated between.
func splineOf(c Conveyor) []frm_models.Location {
	return []frm_models.Location{location(c.From, 0), location(c.To, 0)}
}

func renderBelts(w *World) []frm_models.Belt {
	out := make([]frm_models.Belt, 0, len(w.Belts))
	for _, c := range w.Belts {
		out = append(out, frm_models.Belt{
			ID:             c.ID,
			Name:           c.Name,
			ClassName:      c.Class,
			Location0:      location(c.From, 0),
			Location1:      location(c.To, 0),
			Connected0:     true,
			Connected1:     true,
			SplineData:     splineOf(c),
			Length:         c.Length,
			ItemsPerMinute: c.Flow,
		})
	}
	return out
}

func renderPipes(w *World) []frm_models.Pipe {
	out := make([]frm_models.Pipe, 0, len(w.Pipes))
	for _, c := range w.Pipes {
		out = append(out, frm_models.Pipe{
			ID:             c.ID,
			Name:           c.Name,
			ClassName:      c.Class,
			Location0:      location(c.From, 0),
			Location1:      location(c.To, 0),
			Connected0:     true,
			Connected1:     true,
			SplineData:     splineOf(c),
			Length:         c.Length,
			ItemsPerMinute: c.Flow,
		})
	}
	return out
}

func renderSplitters(w *World) []frm_models.SplitterMerger {
	out := make([]frm_models.SplitterMerger, 0, len(w.Splitters))
	for _, j := range w.Splitters {
		out = append(out, frm_models.SplitterMerger{
			ID:          j.ID,
			Name:        j.Name,
			ClassName:   j.Class,
			Location:    location(j.Loc, 0),
			BoundingBox: boxAround(j.Loc, 400, 400, 200),
		})
	}
	return out
}

func renderPipeJunctions(w *World) []frm_models.PipeJunction {
	out := make([]frm_models.PipeJunction, 0, len(w.PipeJunctions))
	for _, j := range w.PipeJunctions {
		out = append(out, frm_models.PipeJunction{
			ID:        j.ID,
			Name:      j.Name,
			ClassName: j.Class,
			Location:  location(j.Loc, 0),
		})
	}
	return out
}

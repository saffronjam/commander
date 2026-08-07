package frmmock

import "math"

// stream is a splitmix64 generator. It is used instead of math/rand so a world is
// reproducible across Go versions, which is what makes the golden digests
// meaningful.
type stream struct {
	state uint64
}

// derive returns an independent stream for one subsystem. Keying by label rather
// than by draw order means adding a generation step cannot shift the coordinates
// of everything generated after it, so golden digests survive new features.
func derive(seed int64, label string, index int) *stream {
	h := uint64(0xcbf29ce484222325)
	for i := 0; i < len(label); i++ {
		h ^= uint64(label[i])
		h *= 0x100000001b3
	}
	h ^= uint64(seed) * 0x9e3779b97f4a7c15
	h ^= uint64(index+1) * 0xbf58476d1ce4e5b9
	return &stream{state: h}
}

func (s *stream) next() uint64 {
	s.state += 0x9e3779b97f4a7c15
	z := s.state
	z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9
	z = (z ^ (z >> 27)) * 0x94d049bb133111eb
	return z ^ (z >> 31)
}

// float returns a value in [0, 1).
func (s *stream) float() float64 {
	return float64(s.next()>>11) / float64(1<<53)
}

// between returns a value in [lo, hi).
func (s *stream) between(lo, hi float64) float64 {
	return lo + s.float()*(hi-lo)
}

// intn returns a value in [0, n).
func (s *stream) intn(n int) int {
	if n <= 0 {
		return 0
	}
	return int(s.next() % uint64(n))
}

// pick returns one element of vs.
func pick[T any](s *stream, vs []T) T {
	return vs[s.intn(len(vs))]
}

// quantise rounds to a fixed number of decimals so generated coordinates and
// rates serialise to short, stable JSON rather than full float64 noise.
func quantise(v float64, decimals int) float64 {
	p := math.Pow10(decimals)
	return math.Round(v*p) / p
}

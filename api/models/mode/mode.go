package mode

const (
	Dev  = "dev"
	Prod = "prod"
	Test = "test"
)

// IsValid reports whether s is one of the three application modes.
func IsValid(s string) bool {
	return s == Dev || s == Prod || s == Test
}

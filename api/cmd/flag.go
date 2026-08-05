package cmd

import (
	"api/models/mode"
	argFlag "flag"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Options holds the parsed command-line options. Serving always runs the HTTP
// server, the poller, and background workers together — there is no worker-flag
// split.
type Options struct {
	Mode string

	// Migrate holds the direction (up, down, version) when the `migrate`
	// subcommand was invoked, and is empty when the process should serve.
	Migrate string
	// MigrateSteps bounds an up/down run to N migrations; 0 means "all pending"
	// for up and a single step for down.
	MigrateSteps int
}

// ParseFlags parses the process arguments into Options. With no subcommand the
// process serves; `migrate up|down|version [steps]` runs the migration chain
// and exits.
func ParseFlags() *Options {
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		return parseMigrateFlags(os.Args[2:])
	}

	opts := &Options{}
	argFlag.StringVar(&opts.Mode, "mode", mode.Dev, "Application mode: prod, dev, or test")
	argFlag.Parse()

	if !mode.IsValid(opts.Mode) {
		panic("Invalid mode specified. Valid options are: test, dev, prod")
	}

	return opts
}

func parseMigrateFlags(args []string) *Options {
	usage := func() {
		fmt.Fprintln(os.Stderr, "usage: satisfactory-dashboard migrate up|down|version [steps] [-mode dev|prod|test]")
		os.Exit(2)
	}

	if len(args) == 0 {
		usage()
	}

	opts := &Options{Migrate: args[0]}
	if opts.Migrate != "up" && opts.Migrate != "down" && opts.Migrate != "version" {
		usage()
	}

	rest := args[1:]
	if len(rest) > 0 && !strings.HasPrefix(rest[0], "-") {
		steps, err := strconv.Atoi(rest[0])
		if err != nil || steps < 1 {
			fmt.Fprintf(os.Stderr, "invalid step count %q\n", rest[0])
			os.Exit(2)
		}
		opts.MigrateSteps = steps
		rest = rest[1:]
	}

	fs := argFlag.NewFlagSet("migrate", argFlag.ExitOnError)
	fs.StringVar(&opts.Mode, "mode", mode.Dev, "Application mode: prod, dev, or test")
	if err := fs.Parse(rest); err != nil {
		usage()
	}

	if !mode.IsValid(opts.Mode) {
		usage()
	}

	return opts
}

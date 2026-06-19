package cmd

import (
	"api/models/mode"
	argFlag "flag"
)

// Options holds the parsed command-line options. The process always runs the
// HTTP server, the poller, and background workers together — there is no
// worker-flag split.
type Options struct {
	Mode string
}

// ParseFlags parses the process flags into Options.
func ParseFlags() *Options {
	opts := &Options{}
	argFlag.StringVar(&opts.Mode, "mode", mode.Dev, "Application mode: prod, dev, or test")
	argFlag.Parse()

	if opts.Mode != mode.Test && opts.Mode != mode.Prod && opts.Mode != mode.Dev {
		panic("Invalid mode specified. Valid options are: test, dev, prod")
	}

	return opts
}

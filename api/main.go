package main

import (
	"api/cmd"
	"fmt"
	"os"
)

func main() {
	options := cmd.ParseFlags()

	if options.Migrate != "" {
		if err := cmd.RunMigrate(options); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}

	deployApp := cmd.Create(options)
	if deployApp == nil {
		panic("failed to start app")
	}
	defer deployApp.Stop()

	quit := make(chan os.Signal)
	<-quit
}

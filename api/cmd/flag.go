package cmd

import (
	"api/worker"
	"context"
)

type FlagType string

const (
	FlagTypeWorker FlagType = "worker"
	FlagTypeGlobal FlagType = "global"
)

// FlagDefinition represents a definition for a flag that is passed to the program's executable.
type FlagDefinition struct {
	Name         string
	ValueType    string
	Description  string
	FlagType     FlagType
	DefaultValue interface{}
	PassedValue  interface{}
	Run          func(ctx context.Context, cancel context.CancelFunc)
}

// GetPassedValue returns the value passed to the flag.
func (flag *FlagDefinition) GetPassedValue() interface{} {
	return flag.PassedValue
}

type FlagDefinitionList []FlagDefinition

// IsPassed returns true if the flag was passed to the program.
func (list *FlagDefinitionList) IsPassed(name string) bool {
	for _, flag := range *list {
		if flag.Name == name {
			return flag.GetPassedValue() != interface{}(nil)
		}
	}

	return false
}

// GetPassedValue returns the value passed to the flag.
func (list *FlagDefinitionList) GetPassedValue(name string) interface{} {
	for _, flag := range *list {
		if flag.Name == name {
			return flag.GetPassedValue()
		}
	}

	return nil
}

// SetPassedValue sets the value passed to the flag.
func (list *FlagDefinitionList) SetPassedValue(name string, value interface{}) {
	for idx, flag := range *list {
		if flag.Name == name {
			(*list)[idx].PassedValue = value
			return
		}
	}
}

// AnyWorkerFlagsPassed returns true if any worker flags were passed to the program.
func (list *FlagDefinitionList) AnyWorkerFlagsPassed() bool {
	for _, flag := range *list {
		if flag.FlagType == FlagTypeWorker && flag.GetPassedValue().(bool) {
			return true
		}
	}

	return false
}

// GetFlags returns a list of all flags that can be passed to the program.
func GetFlags() FlagDefinitionList {
	return []FlagDefinition{
		{
			Name:         "mode",
			ValueType:    "string",
			FlagType:     FlagTypeGlobal,
			Description:  "Set the mode of the application, 'prod', 'dev', or 'test'",
			DefaultValue: "dev",
		},
		{
			Name:         "api",
			ValueType:    "bool",
			FlagType:     FlagTypeWorker,
			Description:  "Start api server",
			DefaultValue: false,
			Run:          nil,
		},
		{
			Name:         "publisher",
			ValueType:    "bool",
			FlagType:     FlagTypeWorker,
			Description:  "Start the publisher worker",
			DefaultValue: false,
			Run: func(ctx context.Context, cancel context.CancelFunc) {
				worker.Publisher(ctx)
			},
		},
	}
}

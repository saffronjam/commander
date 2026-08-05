package log

import (
	"api/models/mode"
	"errors"
	"fmt"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"strings"
)

var (
	Logger      *zap.SugaredLogger
	baseLogger  *zap.Logger
	LoggerMap   = make(map[string]*zap.SugaredLogger)
	atomicLevel zap.AtomicLevel
)

var (
	Bold  = "\033[1m"
	Reset = "\033[0m"

	Orange    = "\033[38;5;208m"
	Grey      = "\033[90m"
	LightGrey = "\033[37m"
	Red       = "\033[31m"
	Green     = "\033[32m"
	Cyan      = "\033[36m"

	runMode       = "development"
	defaultLogger = "default"
)

// A no-op logger keeps every log call safe before SetupLogger runs. The process
// configures the real logger as its first init task, so nothing user-facing is
// lost; without this, any log call from a package under test panics on nil.
func init() {
	Logger = zap.NewNop().Sugar()
}

// SetupLogger initializes the logging system with the given run mode.
func SetupLogger(m string) error {
	runMode = m

	// Determine initial level based on mode
	var initialLevel zapcore.Level
	if runMode != mode.Prod {
		initialLevel = zapcore.DebugLevel
	} else {
		initialLevel = zapcore.InfoLevel
	}

	// Create atomic level for runtime changes
	atomicLevel = zap.NewAtomicLevelAt(initialLevel)

	// Create logger with atomic level
	var config zap.Config
	if runMode != mode.Prod {
		config = zap.NewDevelopmentConfig()
	} else {
		config = zap.NewProductionConfig()
	}
	config.Level = atomicLevel

	baseLogger = zap.Must(config.Build(zap.WithCaller(false)))
	Logger = Get(defaultLogger)

	return nil
}

// GetBaseLogger returns the underlying zap.Logger for use with components
// that require structured logging with typed fields instead of sugared logging.
func GetBaseLogger() *zap.Logger {
	if baseLogger == nil {
		// Fallback initialization
		atomicLevel = zap.NewAtomicLevelAt(zapcore.InfoLevel)
		config := zap.NewDevelopmentConfig()
		config.Level = atomicLevel
		baseLogger = zap.Must(config.Build(zap.WithCaller(false)))
	}
	return baseLogger
}

// SetLogLevel changes the log level at runtime
func SetLogLevel(level zapcore.Level) {
	atomicLevel.SetLevel(level)
	Infof("Log level changed to: %s", level.String())
}

// GetLogLevel returns the current log level
func GetLogLevel() zapcore.Level {
	return atomicLevel.Level()
}

func Get(name string) *zap.SugaredLogger {
	if sugaredLogger, ok := LoggerMap[name]; ok {
		return sugaredLogger
	}

	var sugaredLogger *zap.SugaredLogger

	// Use the base logger with atomic level if available
	if baseLogger != nil {
		if name == defaultLogger {
			sugaredLogger = baseLogger.Sugar()
		} else {
			sugaredLogger = baseLogger.Sugar().Named(name)
		}
	} else {
		// Fallback if SetupLogger hasn't been called
		if runMode != mode.Prod {
			logger := zap.Must(zap.NewDevelopment(zap.WithCaller(false)))
			if name == defaultLogger {
				sugaredLogger = logger.Sugar()
			} else {
				sugaredLogger = logger.Sugar().Named(name)
			}
		} else {
			logger := zap.Must(zap.NewProduction(zap.WithCaller(false)))
			sugaredLogger = logger.Sugar().Named(name)

			Bold = ""
			Reset = ""
			Orange = ""
			Grey = ""
			LightGrey = ""
			Red = ""
			Green = ""
			Cyan = ""
		}
	}

	LoggerMap[name] = sugaredLogger
	return sugaredLogger
}

// Logln logs a message at provided level.
// Spaces are always added between arguments.
func Logln(lvl zapcore.Level, args ...interface{}) {
	Logger.Logln(lvl, args...)
}

// Debugln logs a message at [DebugLevel].
// Spaces are always added between arguments.
func Debugln(args ...interface{}) {
	Logger.Debugln(args...)
}

// Println logs a message at [InfoLevel].
// Spaces are always added between arguments.
// This is an alias for Infoln.
func Println(args ...interface{}) {
	Logger.Infoln(args...)
}

// Infoln logs a message at [InfoLevel].
// Spaces are always added between arguments.
func Infoln(args ...interface{}) {
	Logger.Infoln(args...)
}

// Warnln logs a message at [WarnLevel].
// Spaces are always added between arguments.
func Warnln(args ...interface{}) {
	Logger.Warnln(args...)
}

// Errorln logs a message at [ErrorLevel].
// Spaces are always added between arguments.
func Errorln(args ...interface{}) {
	Logger.Errorln(args...)
}

// Fatalln logs a message at [FatalLevel] and then calls os.Exit(1).
// Spaces are always added between arguments.
func Fatalln(args ...interface{}) {
	Logger.Fatalln(args...)
}

// Logf formats the message according to the format specifier
// and logs it at provided level.
func Logf(lvl zapcore.Level, template string, args ...interface{}) {
	Logger.Logf(lvl, template, args...)
}

// Debugf formats the message according to the format specifier
// and logs it at [DebugLevel].
func Debugf(template string, args ...interface{}) {
	Logger.Debugf(template, args...)
}

// Printf formats the message according to the format specifier
// and logs it at [InfoLevel].
// This is an alias for Infof.
func Printf(template string, args ...interface{}) {
	Logger.Infof(template, args...)
}

// Infof formats the message according to the format specifier
// and logs it at [InfoLevel].
func Infof(template string, args ...interface{}) {
	Logger.Infof(template, args...)
}

// Warnf formats the message according to the format specifier
// and logs it at [WarnLevel].
func Warnf(template string, args ...interface{}) {
	Logger.Warnf(template, args...)
}

// Errorf formats the message according to the format specifier
// and logs it at [ErrorLevel].
func Errorf(template string, args ...interface{}) {
	Logger.Errorf(template, args...)
}

// Fatalf formats the message according to the format specifier
// and logs it at [FatalLevel].
func Fatalf(template string, args ...interface{}) {
	Logger.Fatalf(template, args...)
}

// PrettyError prints an error in a pretty way
// It splits on `details: ` and adds `due to: \n`
func PrettyError(err error) {
	all := make([]string, 0)

	currentErr := err
	for errors.Unwrap(currentErr) != nil {
		all = append(all, currentErr.Error())
		currentErr = errors.Unwrap(currentErr)
	}

	all = append(all, currentErr.Error())

	for i := 0; i < len(all); i++ {
		// remove the parts of the string that exists in all[i+1]
		if i+1 < len(all) {
			all[i] = strings.ReplaceAll(all[i], all[i+1], "")
		}
	}

	for i := 0; i < len(all); i++ {
		// remove details: from the string
		all[i] = strings.ReplaceAll(all[i], "details: ", "")

		// remove punctuation in the end of the string
		all[i] = strings.TrimRight(all[i], ".")
	}

	output := ""

	for i := 0; i < len(all); i++ {
		if i == 0 {
			//output = all[i]
			output = fmt.Sprintf("%s%s%s%s", Bold, Red, all[i], Reset)
		} else {
			output = fmt.Sprintf("%s\n\t%sdue to:%s %s", output, LightGrey, Reset, all[i])
		}
	}

	Println(output)
}

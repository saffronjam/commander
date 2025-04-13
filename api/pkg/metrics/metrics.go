package metrics

import (
	"api/pkg/db/key_value"
	"api/pkg/log"
	"fmt"
	"github.com/penglongli/gin-metrics/ginmetrics"
	"strconv"
)

var Metrics MetricsType

const (
	// Prefix is the prefix for all metrics.
	Prefix = "go_deploy_"
)

type MetricsType struct {
	Collectors []MetricDefinition
}

type MetricDefinition struct {
	Name        string
	Description string
	Key         string
	MetricType  ginmetrics.MetricType
}

const (
	Dummy = "dummy"
)

func Setup() error {
	collectors := GetCollectors()

	Metrics = MetricsType{
		Collectors: collectors,
	}

	m := ginmetrics.GetMonitor()

	for _, def := range collectors {
		switch def.MetricType {
		case ginmetrics.Gauge:
			err := m.AddMetric(&ginmetrics.Metric{
				Type:        ginmetrics.Gauge,
				Name:        def.Name,
				Description: def.Description,
				Labels:      []string{},
			})
			if err != nil {
				return fmt.Errorf("failed to add metric %s to monitor. details: %w", def.Name, err)
			}
		default:
			return fmt.Errorf("unknown metric type %d", def.MetricType)
		}
	}

	return nil
}

// Sync synchronizes the metrics with the values in the database.
func Sync() {
	client := key_value.New()
	monitor := ginmetrics.GetMonitor()

	for _, collector := range Metrics.Collectors {
		valueStr, err := client.Get(collector.Key)
		if err != nil {
			log.PrettyError(fmt.Errorf("error getting value for key %s when synchronizing metrics. details: %w", collector.Key, err))
			continue
		}

		if valueStr == "" {
			continue
		}

		value, err := strconv.ParseFloat(valueStr, 64)
		if err != nil {
			log.PrettyError(fmt.Errorf("error parsing value %s when synchronizing metrics. details: %w", valueStr, err))
			continue
		}

		metric := monitor.GetMetric(collector.Name)
		if metric == nil {
			log.PrettyError(fmt.Errorf("metric %s not found when synchronizing metrics", collector.Name))
			continue
		}

		switch collector.MetricType {
		case ginmetrics.Gauge:
			err = metric.SetGaugeValue([]string{}, value)
			if err != nil {
				log.PrettyError(fmt.Errorf("error setting gauge value for metric %s when synchronizing metrics. details: %w", collector.Name, err))
				return
			}
		default:
			panic("unknown metric type " + strconv.Itoa(int(collector.MetricType)))
		}
	}
}

// GetCollectors returns all collectors.
func GetCollectors() []MetricDefinition {
	defs := []MetricDefinition{
		{
			Name:        "dummy",
			Description: "dummy",
			Key:         Dummy,
			MetricType:  ginmetrics.Gauge,
		},
	}

	for i := range defs {
		defs[i].Name = Prefix + defs[i].Name
	}

	return defs
}

package frm_client

import (
	"api/models/models"
	"api/service/frm_client/frm_models"
	"context"
	"fmt"
	"sync"
)

// GetMachines fetches all machines: factory, extractors, and generators
func (client *Client) GetMachines(ctx context.Context) ([]models.Machine, error) {
	var machines []models.Machine
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstError error

	// Helper to determine machine status based on FRM API boolean flags
	machineStatus := func(isConfigured, isProducing, isPaused bool) models.MachineStatus {
		if !isConfigured {
			return models.MachineStatusUnconfigured
		}
		if isPaused {
			return models.MachineStatusPaused
		}
		if isProducing {
			return models.MachineStatusOperating
		}
		return models.MachineStatusIdle
	}

	// Fetch Extractors
	wg.Add(1)
	go func() {
		defer wg.Done()
		var rawExtractors []frm_models.Extractor
		err := client.makeSatisfactoryCall(ctx, "/getExtractor", &rawExtractors)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get extractors. details: %w", err)
			}
			mu.Unlock()
			return
		}

		mu.Lock()
		defer mu.Unlock()
		for _, raw := range rawExtractors {
			extractorProductivity := 0.0
			if len(raw.Production) > 0 {
				extractorProductivity = raw.Production[0].ProdPercent / 100.0
			}

			machine := models.Machine{
				Type:         machineTypeFromName(raw.Name),
				Category:     models.MachineCategoryExtractor,
				Status:       machineStatus(raw.IsConfigured, raw.IsProducing, raw.IsPaused),
				Productivity: extractorProductivity,
				CircuitIDs:   parseCircuitIDsFromPowerInfo(raw.PowerInfo),
				Location:     parseLocation(raw.Location),
				BoundingBox:  parseBoundingBox(raw.BoundingBox),
				Input: []models.MachineProdStats{
					{Name: "Power", Current: raw.PowerInfo.PowerConsumed * 1_000_000, Max: raw.PowerInfo.MaxPowerConsumed * 1_000_000},
				},
				Output: make([]models.MachineProdStats, len(raw.Production)),
			}
			for i, prod := range raw.Production {
				machine.Output[i] = models.MachineProdStats{
					Name:       prod.Name,
					Stored:     prod.Amount,
					Current:    prod.CurrentProd,
					Max:        prod.MaxProd,
					Efficiency: prod.ProdPercent / 100.0,
				}
			}
			machines = append(machines, machine)
		}
	}()

	// Fetch Factory Machines
	wg.Add(1)
	go func() {
		defer wg.Done()
		var rawFactories []frm_models.FactoryMachine
		err := client.makeSatisfactoryCall(ctx, "/getFactory", &rawFactories)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get factory machines. details: %w", err)
			}
			mu.Unlock()
			return
		}

		mu.Lock()
		defer mu.Unlock()
		for _, raw := range rawFactories {
			status := machineStatus(raw.IsConfigured, raw.IsProducing, raw.IsPaused)

			machine := models.Machine{
				Type:         machineTypeFromName(raw.Name),
				Category:     models.MachineCategoryFactory,
				Status:       status,
				Productivity: raw.Productivity / 100.0,
				CircuitIDs:   parseCircuitIDsFromPowerInfo(raw.PowerInfo),
				Location:     parseLocation(raw.Location),
				BoundingBox:  parseBoundingBox(raw.BoundingBox),
				Input: []models.MachineProdStats{
					{Name: "Power", Current: raw.PowerInfo.PowerConsumed * 1_000_000, Max: raw.PowerInfo.MaxPowerConsumed * 1_000_000},
				},
				Output: make([]models.MachineProdStats, len(raw.Production)),
			}
			for _, ing := range raw.Ingredients {
				machine.Input = append(machine.Input, models.MachineProdStats{
					Name:       ing.Name,
					Stored:     ing.Amount,
					Current:    ing.CurrentConsumed,
					Max:        ing.MaxConsumed,
					Efficiency: ing.ConsPercent / 100.0,
				})
			}
			for i, prod := range raw.Production {
				machine.Output[i] = models.MachineProdStats{
					Name:       prod.Name,
					Stored:     prod.Amount,
					Current:    prod.CurrentProd,
					Max:        prod.MaxProd,
					Efficiency: prod.ProdPercent / 100.0,
				}
			}
			machines = append(machines, machine)
		}
	}()

	generatorStatus := func(currentPowerOutput, maxPowerOutput float64) models.MachineStatus {
		if maxPowerOutput == 0 {
			return models.MachineStatusUnconfigured
		}
		if currentPowerOutput == 0 {
			return models.MachineStatusIdle
		}
		return models.MachineStatusOperating
	}

	// Fetch Generators
	wg.Add(1)
	go func() {
		defer wg.Done()
		var rawGenerators []frm_models.Generator
		err := client.makeSatisfactoryCall(ctx, "/getGenerators", &rawGenerators)
		if err != nil {
			mu.Lock()
			if firstError == nil {
				firstError = fmt.Errorf("failed to get generators. details: %w", err)
			}
			mu.Unlock()
			return
		}

		currentPowerByType := func(gen *frm_models.Generator, genType models.PowerType) float64 {
			if genType == models.PowerTypeGeothermal {
				return gen.ProductionCapacity * 1_000_000
			}
			return gen.RegulatedDemandProd * 1_000_000
		}

		maxPowerByType := func(gen *frm_models.Generator, genType models.PowerType) float64 {
			if genType == models.PowerTypeGeothermal {
				return gen.ProductionCapacity * 1_000_000
			}
			return gen.BaseProd * 1_000_000
		}

		mu.Lock()
		defer mu.Unlock()
		for _, raw := range rawGenerators {
			genType := client.blueprintGeneratorNameToType(raw.Name)
			if genType == models.PowerTypeUnknown {
				continue
			}

			power := currentPowerByType(&raw, genType)
			productivity := 1.0
			if power == 0 {
				productivity = 0.0
			}

			maxPower := maxPowerByType(&raw, genType)

			machine := models.Machine{
				Type:         machineTypeFromName(raw.Name),
				Category:     models.MachineCategoryGenerator,
				Status:       generatorStatus(power, maxPower),
				Productivity: productivity,
				Location:     parseLocation(raw.Location),
				BoundingBox:  parseBoundingBox(raw.BoundingBox),
				CircuitIDs:   parseCircuitIDs(raw.CircuitID),
				Input:        []models.MachineProdStats{},
				Output: []models.MachineProdStats{
					{
						Name:    "Power",
						Current: power,
						Max:     maxPower,
					},
				},
			}
			machines = append(machines, machine)
		}
	}()

	wg.Wait()

	if firstError != nil {
		return nil, firstError
	}

	return machines, nil
}

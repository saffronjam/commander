package frmmock

import "api/models/models"

// renderSessionInfo reports the save name and the in-game clock. The save name must
// be stable across polls or the dashboard treats the session as pointed at a
// different save and stops ingesting.
func renderSessionInfo(w *World, t float64) models.SessionInfoRaw {
	hours, minutes, seconds, isDay, passedDays := gameClock(t)
	total := w.PlayDurationBase + int(t)

	return models.SessionInfoRaw{
		SessionName:                w.SaveName,
		IsPaused:                   false,
		DayLength:                  dayLengthSeconds,
		NightLength:                nightLengthSeconds,
		PassedDays:                 passedDays,
		NumberOfDaysSinceLastDeath: passedDays,
		Hours:                      hours,
		Minutes:                    minutes,
		Seconds:                    seconds,
		IsDay:                      isDay,
		TotalPlayDuration:          total,
		TotalPlayDurationText:      hhmmss(float64(total)),
	}
}

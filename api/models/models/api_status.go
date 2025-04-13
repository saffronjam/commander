package models

type SatisfactoryApiStatus struct {
	Running bool `json:"running"`
	PingMS  int  `json:"pingMs"`
}

func (satisfactoryApiStatus *SatisfactoryApiStatus) ToDTO() SatisfactoryApiStatusDTO {
	return *satisfactoryApiStatus
}

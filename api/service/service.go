package service

import (
	"api/service/client"
	"api/service/implClient"
)

func NewClient() client.Client {
	return implClient.NewClient()
}

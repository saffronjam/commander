#!/bin/bash

echo "Installing swaggo/swag"
go install github.com/swaggo/swag/v2/cmd/swag@latest

export PATH=$(go env GOPATH)/bin:$PATH
swag init --dir ../  -o ../docs/api/v1 --exclude --instanceName "V1" -v3.1
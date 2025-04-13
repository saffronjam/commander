############################
# STEP 1 build executable binary
############################
FROM --platform=$BUILDPLATFORM golang:alpine AS builder
# Install git.
RUN apk update && apk add --no-cache git=~2

# Set up working directory
WORKDIR /app
# Copy go.mod and go.sum separately so we only invalidate the downloading layers if we need to
COPY go.mod go.sum ./

# Fetch dependencies and build the binary
ENV GO111MODULE=on
RUN go mod download

# Copy the rest of the project to ensure code changes doesnt trigger re-download of all deps
COPY . .

RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$GOARCH go build -a -installsuffix cgo -o main .


############################
# STEP 2 build a small image
############################
FROM alpine:3

WORKDIR /go

COPY --from=builder /app/main .
COPY --from=builder /app/docs docs
COPY --from=builder /app/config.docker.yml config.local.yml

ENV GIN_MODE=release

ENTRYPOINT ["./main"]
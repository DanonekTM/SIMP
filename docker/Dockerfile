# Build frontend
FROM node:23-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Build backend
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app/backend

# Install build dependencies for SQLite and cross-compilation
RUN apk add --no-cache gcc musl-dev g++ make

COPY backend/go.* ./
RUN go mod download
COPY backend/ .

# Enable CGO and set target platform based on build platform
ARG TARGETARCH
ENV CGO_ENABLED=1
ENV GOOS=linux
ENV GOARCH=${TARGETARCH}
RUN go build -o simp cmd/main.go

# Final stage
FROM alpine:latest
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata sqlite

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Copy backend binary and static files
COPY --from=backend-builder /app/backend/simp /app/simp
COPY --from=backend-builder /app/backend/frontend/static /app/frontend/static

# Create necessary directories
RUN mkdir -p /app/logs /app/storage

# Command to run the application
CMD ["/app/simp"] 

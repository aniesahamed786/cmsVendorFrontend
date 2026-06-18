# ---------- Stage 1 : Build Angular ----------
    FROM me-central2-docker.pkg.dev/aramco-artifacts/node/node:20 AS builder
 
    WORKDIR /app
     
    # Copy dependency files
    COPY package*.json ./
     
    # Install dependencies
    RUN npm install
     
    # Copy project files
    COPY . .
     
    # Build Angular project
    RUN npm run build
     
     
    # ---------- Stage 2 : Nginx ----------
    FROM me-central2-docker.pkg.dev/sao-prj-shr-30049727-ar-0/shr-30049727-dkr-vrt-0/chainguard/nginx:latest
     
    RUN rm /etc/nginx/conf.d/default.conf
     
    COPY nginx.conf /etc/nginx/conf.d/default.conf
     
    # Angular 17+ build output
    COPY --from=builder /app/dist/cms-vendor-frontend/browser /usr/share/nginx/html
     
    EXPOSE 8081
     
    CMD ["nginx", "-g", "daemon off;"]

FROM node:18-bullseye-slim

# set working dir
WORKDIR /usr/src/app

# copy only package manifests first for caching
COPY package*.json ./

# install build dependencies, run install, then remove build deps to keep image small
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm install --production --unsafe-perm --no-audit --prefer-offline \
  && apt-get remove -y python3 make g++ \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/* /root/.npm

# copy rest of application
COPY . .

# (optional) create a non-root user and give ownership of app files
# Uncomment if you want the container to run as non-root
# RUN useradd -m app && chown -R app:app /usr/src/app
# USER app

# Note: Do NOT change CMD/entrypoint in this patch because the repository's start file may vary.
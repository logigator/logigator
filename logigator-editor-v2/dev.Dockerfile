FROM node:24
RUN apt-get update -qq && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*
ENV CHROME_BIN=/usr/bin/chromium

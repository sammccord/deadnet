FROM oven/bun:1
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json .
ADD dist ./dist

# run the app
USER bun
EXPOSE 3000/tcp
CMD ["bun", "run", "dist/index.js" ]

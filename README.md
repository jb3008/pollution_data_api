# Polluted Cities API

## Overview

This service provides a `/cities` endpoint that fetches a list of polluted cities, filters out invalid entries, and enriches valid city records with short Wikipedia descriptions.

## Features

- Fetches data from mock pollution API
- Filters invalid / corrupted records
- Caches Wikipedia results to avoid hitting rate limits
- Returns a clean, enriched JSON response

## How to Run Locally

```bash
git clone <your-repo-url>
cd polluted-cities-api
npm install
npm start
```
